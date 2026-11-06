/* ==========================================================================
   Leitura do Blogger
   O site busca as postagens e páginas publicadas no Blogger (feed público,
   via JSONP) e converte cada postagem numa matéria do portal, seguindo as
   regras do Manual de Publicação:
     - campo Título            -> manchete
     - 1ª imagem do texto      -> capa (legenda vira crédito)
     - 1º parágrafo após capa  -> linha fina
     - Subtítulo               -> intertítulo
     - aspas                   -> citação em destaque
     - 2+ imagens seguidas     -> galeria
     - YouTube / Spotify / SoundCloud -> players
     - marcador                -> editoria
   ========================================================================== */
(function () {
  'use strict';

  var BLOG = 'https://crisepoliticadocorinthians.blogspot.com';
  var AUTOR = 'Leonardo Zelli';
  var PALAVRAS_POR_MINUTO = 200;
  var CACHE_MIN = 3;

  var IFRAMES_PERMITIDOS = /^(https?:)?\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|open\.spotify\.com|w\.soundcloud\.com|drive\.google\.com|docs\.google\.com|www\.google\.com\/maps|www\.blogger\.com\/video|anchor\.fm|podcasters\.spotify\.com)/i;

  /* ---------- JSONP ---------- */
  var seq = 0;
  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var nome = '__cpc' + Date.now() + (seq++);
      var s = document.createElement('script');
      var timer = setTimeout(function () { limpar(); reject(new Error('Tempo esgotado ao ler o Blogger')); }, 15000);
      function limpar() { clearTimeout(timer); delete window[nome]; if (s.parentNode) s.parentNode.removeChild(s); }
      window[nome] = function (dados) { limpar(); resolve(dados); };
      s.onerror = function () { limpar(); reject(new Error('Falha ao ler o Blogger')); };
      s.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'alt=json-in-script&callback=' + nome;
      document.head.appendChild(s);
    });
  }

  /* cache curto entre páginas, para a navegação ficar instantânea */
  function doCache(chave) {
    try {
      var c = JSON.parse(sessionStorage.getItem(chave) || 'null');
      if (c && Date.now() - c.t < CACHE_MIN * 60000) return c.d;
    } catch (e) {}
    return null;
  }
  function paraCache(chave, d) { try { sessionStorage.setItem(chave, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }

  function buscarFeed(tipo) {
    // ambiente de teste local: usa um feed de exemplo em vez do Blogger
    if (window.__CPC_TESTE) return Promise.resolve(window.__CPC_TESTE[tipo] || []);
    var chave = 'cpc-feed-' + tipo;
    var c = doCache(chave);
    if (c) return Promise.resolve(c);
    var url = BLOG + '/feeds/' + tipo + '/default?max-results=150' + (tipo === 'posts' ? '&orderby=published' : '');
    return jsonp(url).then(function (r) {
      var entradas = (r.feed && r.feed.entry) || [];
      var leves = entradas.map(function (e) {
        var alt = (e.link || []).filter(function (l) { return l.rel === 'alternate'; })[0];
        return {
          id: (e.id.$t.split(/post-|page-/)[1] || ''),
          titulo: (e.title && e.title.$t) || '',
          publicado: e.published.$t,
          marcadores: (e.category || []).map(function (c) { return c.term; }),
          link: alt ? alt.href : '',
          html: (e.content && e.content.$t) || (e.summary && e.summary.$t) || '',
          thumb: e.media$thumbnail ? e.media$thumbnail.url : ''
        };
      });
      paraCache(chave, leves);
      return leves;
    });
  }

  /* ---------- utilitários ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function texto(el) { return (el.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function slugDe(link) { var m = /\/([^\/]+)\.html/.exec(link || ''); return m ? m[1] : ''; }

  /* imagem do Blogger em outra resolução */
  function imgTamanho(src, px) {
    if (!src) return src;
    if (/\/(s|w|h)\d+[^\/]*\/[^\/]+$/.test(src)) return src.replace(/\/(s|w|h)\d+[^\/]*\/([^\/]+)$/, '/s' + px + '/$2');
    if (/=s\d+[^\/]*$/.test(src)) return src.replace(/=s\d+[^\/]*$/, '=s' + px);
    if (/=w\d+-h\d+[^\/]*$/.test(src)) return src.replace(/=w\d+-h\d+[^\/]*$/, '=s' + px);
    return src;
  }

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataExtenso(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    return parseInt(m[3], 10) + ' de ' + MESES[parseInt(m[2], 10) - 1] + ' de ' + m[1];
  }

  /* ---------- limpeza do HTML vindo do Blogger ---------- */
  var BLOCOS = /^(P|DIV|FIGURE|H[1-6]|BLOCKQUOTE|UL|OL|TABLE|IFRAME|HR|PRE)$/;
  function ehBloco(n) { return n.nodeType === 1 && BLOCOS.test(n.nodeName); }

  function desembrulhar(el) {
    var pai = el.parentNode;
    while (el.firstChild) pai.insertBefore(el.firstChild, el);
    pai.removeChild(el);
  }
  function renomear(el, tag) {
    var novo = el.ownerDocument.createElement(tag);
    while (el.firstChild) novo.appendChild(el.firstChild);
    el.parentNode.replaceChild(novo, el);
    return novo;
  }
  function vazio(el) {
    if (el.querySelector('img,iframe,figure')) return false;
    return texto(el) === '';
  }

  function limpar(raiz) {
    var doc = raiz.ownerDocument;

    // remove o que não deve ir para a página
    Array.prototype.forEach.call(raiz.querySelectorAll('script,style,link,meta,noscript,object,embed,form,input,button,o\\:p'), function (n) { n.remove(); });

    // atributos: mantém só o essencial
    Array.prototype.forEach.call(raiz.querySelectorAll('*'), function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        var manter = (n === 'href' && el.nodeName === 'A') || (n === 'src' && /^(IMG|IFRAME)$/.test(el.nodeName)) ||
          (n === 'alt' || n === 'title') || (n === 'class' && /tr-caption|separator/.test(a.value)) ||
          (/^(width|height|allow|allowfullscreen|frameborder)$/.test(n) && el.nodeName === 'IFRAME');
        if (!manter || /^on/.test(n) || (n === 'href' && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
      });
      if (el.nodeName === 'A' && el.getAttribute('href')) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
    });

    // iframes fora da lista de players conhecidos saem
    Array.prototype.forEach.call(raiz.querySelectorAll('iframe'), function (f) {
      if (!IFRAMES_PERMITIDOS.test(f.getAttribute('src') || '')) f.remove();
    });

    // spans, fontes e afins viram texto simples
    Array.prototype.forEach.call(raiz.querySelectorAll('span,font,u,center,small,big,sup,sub'), desembrulhar);

    // imagens viram <figure> com legenda (padrão de legenda do Blogger: tabela tr-caption)
    Array.prototype.forEach.call(raiz.querySelectorAll('img'), function (img) {
      if (!img.parentNode) return;
      var tabela = img.closest('table');
      var legenda = '';
      var alvo = img.closest('.separator') || img.closest('a') || img;
      if (tabela && raiz.contains(tabela)) {
        var td = tabela.querySelector('.tr-caption');
        legenda = td ? texto(td) : '';
        alvo = tabela;
      }
      var fig = doc.createElement('figure');
      var nova = doc.createElement('img');
      nova.src = imgTamanho(img.getAttribute('src'), 1600);
      nova.alt = img.getAttribute('alt') || img.getAttribute('title') || legenda || '';
      nova.loading = 'lazy';
      fig.appendChild(nova);
      if (legenda) { var fc = doc.createElement('figcaption'); fc.textContent = legenda; fig.appendChild(fc); }
      // se a imagem está dentro de um parágrafo com texto, a figura vai logo depois dele
      var p = alvo.parentNode;
      while (p && p !== raiz && p.nodeName !== 'P' && p.nodeName !== 'DIV') p = p.parentNode;
      if (p && p !== raiz && texto(p).replace(legenda, '').trim() !== '' && !p.contains(tabela)) {
        alvo.remove();
        p.parentNode.insertBefore(fig, p.nextSibling);
      } else {
        alvo.parentNode.replaceChild(fig, alvo);
      }
    });

    // divs: com blocos dentro -> desembrulha; só com texto -> parágrafo
    var mudou = true;
    while (mudou) {
      mudou = false;
      Array.prototype.forEach.call(raiz.querySelectorAll('div'), function (d) {
        if (!d.parentNode) return;
        var temBloco = Array.prototype.some.call(d.childNodes, ehBloco);
        if (temBloco) desembrulhar(d); else renomear(d, 'p');
        mudou = true;
      });
    }

    // figuras e iframes que ficaram dentro de <p> sobem para o nível de bloco
    Array.prototype.forEach.call(raiz.querySelectorAll('p figure, p iframe'), function (el) {
      var p = el.closest('p');
      if (p && p.parentNode) p.parentNode.insertBefore(el, p.nextSibling);
    });

    // intertítulos: Título/Subtítulo do Blogger -> h2, Subtítulo menor -> h3
    Array.prototype.forEach.call(raiz.querySelectorAll('h1,h2,h3,h4,h5,h6'), function (h) {
      var tag = /H[123]/.test(h.nodeName) ? 'h2' : 'h3';
      var novo = renomear(h, tag);
      Array.prototype.forEach.call(novo.querySelectorAll('b,strong'), desembrulhar);
    });

    // texto solto no nível raiz vira parágrafo
    var solto = [];
    function fecharSolto() {
      if (!solto.length) return;
      var p = doc.createElement('p');
      solto[0].parentNode.insertBefore(p, solto[0]);
      solto.forEach(function (n) { p.appendChild(n); });
      solto = [];
    }
    Array.prototype.slice.call(raiz.childNodes).forEach(function (n) {
      if (n.nodeType === 3 || (n.nodeType === 1 && !ehBloco(n) && n.nodeName !== 'BR')) solto.push(n);
      else fecharSolto();
    });
    fecharSolto();

    // quebras de linha soltas e parágrafos vazios
    Array.prototype.forEach.call(raiz.querySelectorAll(':scope > br'), function (b) { b.remove(); });
    Array.prototype.forEach.call(raiz.querySelectorAll('p'), function (p) {
      while (p.lastChild && (p.lastChild.nodeName === 'BR' || (p.lastChild.nodeType === 3 && !p.lastChild.textContent.trim()))) p.removeChild(p.lastChild);
      while (p.firstChild && (p.firstChild.nodeName === 'BR' || (p.firstChild.nodeType === 3 && !p.firstChild.textContent.replace(/ /g, '').trim()))) p.removeChild(p.firstChild);
      if (vazio(p)) p.remove();
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('h2,h3,blockquote,li'), function (el) { if (vazio(el)) el.remove(); });
    Array.prototype.forEach.call(raiz.querySelectorAll('table'), function (t) {
      if (vazio(t)) { t.remove(); return; }
      var w = doc.createElement('div'); w.className = 'tabela'; t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('.separator'), function (s) { s.removeAttribute('class'); });
  }

  /* citação: o trecho depois das aspas (", afirmou.") vira atribuição */
  function citacoes(raiz) {
    var doc = raiz.ownerDocument;
    Array.prototype.forEach.call(raiz.querySelectorAll('blockquote'), function (bq) {
      var t = texto(bq);
      var fim = Math.max(t.lastIndexOf('”'), t.lastIndexOf('"'));
      if (fim < 0 || fim > t.length - 2) return;
      var resto = t.slice(fim + 1).trim();
      if (!resto || resto.length > 80) return;
      var fala = t.slice(0, fim + 1).trim();
      var atrib = resto.replace(/^[,.;:\s—–-]+/, '').replace(/[.\s]+$/, '');
      if (!atrib) return;
      bq.innerHTML = '';
      var p = doc.createElement('p'); p.textContent = fala; bq.appendChild(p);
      var s = doc.createElement('span'); s.className = 'atribuicao'; s.textContent = atrib; bq.appendChild(s);
    });
  }

  /* iframes ganham moldura responsiva conforme o tipo */
  function embeds(raiz) {
    var doc = raiz.ownerDocument;
    Array.prototype.forEach.call(raiz.querySelectorAll('iframe'), function (f) {
      var src = f.getAttribute('src') || '';
      var w = doc.createElement('div');
      w.className = 'embed';
      if (/spotify/.test(src)) { f.setAttribute('height', /episode|track/.test(src) ? '152' : '352'); f.removeAttribute('width'); }
      else if (/soundcloud/.test(src)) { f.setAttribute('height', f.getAttribute('height') || '166'); f.removeAttribute('width'); }
      else { w.className += ' embed-video'; f.removeAttribute('width'); f.removeAttribute('height'); }
      f.setAttribute('loading', 'lazy');
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      if (!f.getAttribute('allow')) f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
      var alvo = f.parentNode && f.parentNode !== raiz && f.parentNode.childNodes.length === 1 ? f.parentNode : f;
      alvo.parentNode.insertBefore(w, alvo);
      w.appendChild(f);
      if (alvo !== f) alvo.remove();
      // o código de incorporação do SoundCloud traz, logo abaixo do player,
      // uma linha de crédito com links ("Conta · Nome do áudio"): sai
      if (/soundcloud/.test(src)) {
        var prox = w.nextElementSibling;
        while (prox && prox.nodeName === 'P' && vazio(prox)) prox = prox.nextElementSibling;
        if (prox && ehCreditoSoundcloud(prox)) prox.remove();
      }
    });
  }
  function ehCreditoSoundcloud(el) {
    var links = el.querySelectorAll('a');
    if (!links.length) return false;
    var resto = texto(el);
    for (var i = 0; i < links.length; i++) {
      if (!/soundcloud\.com/i.test(links[i].getAttribute('href') || '')) return false;
      resto = resto.replace(texto(links[i]), '');
    }
    return /^[\s·•|\-–—]*$/.test(resto);
  }

  /* 2 ou mais figuras seguidas -> galeria */
  function galerias(raiz) {
    var doc = raiz.ownerDocument;
    var filhos = Array.prototype.slice.call(raiz.children);
    var grupo = [];
    function fechar() {
      if (grupo.length >= 2) {
        var g = doc.createElement('div');
        g.className = 'galeria';
        g.setAttribute('data-galeria', '');
        grupo[0].parentNode.insertBefore(g, grupo[0]);
        grupo.forEach(function (f) { g.appendChild(f); });
      }
      grupo = [];
    }
    filhos.forEach(function (el) { if (el.nodeName === 'FIGURE') grupo.push(el); else fechar(); });
    fechar();
  }

  /* converte o HTML de uma postagem na estrutura da matéria */
  function analisar(html) {
    var doc = new DOMParser().parseFromString('<!doctype html><div id="raiz">' + html + '</div>', 'text/html');
    var raiz = doc.getElementById('raiz');
    limpar(raiz);

    var capa = null;
    var fig = raiz.querySelector('figure');
    if (fig) {
      var im = fig.querySelector('img');
      var fc = fig.querySelector('figcaption');
      capa = { src: im.getAttribute('src'), alt: im.getAttribute('alt') || '', legenda: fc ? texto(fc) : '' };
      fig.remove();
    }

    var linhaFina = '';
    var primeiro = raiz.querySelector(':scope > p');
    if (primeiro) { linhaFina = texto(primeiro); primeiro.remove(); }

    citacoes(raiz);
    embeds(raiz);
    galerias(raiz);

    var palavras = (linhaFina + ' ' + texto(raiz)).split(' ').filter(Boolean).length;
    return {
      capa: capa,
      linhaFina: linhaFina,
      corpo: raiz.innerHTML,
      leitura: Math.max(1, Math.round(palavras / PALAVRAS_POR_MINUTO))
    };
  }

  function montarMateria(e) {
    var a = analisar(e.html);
    var slug = slugDe(e.link) || e.id;
    var capa = a.capa ? a.capa.src : (e.thumb ? imgTamanho(e.thumb, 1600) : '');
    return {
      id: e.id,
      slug: slug,
      url: 'materia.html?p=' + encodeURIComponent(slug),
      titulo: e.titulo || 'Sem título',
      editoria: e.marcadores[0] || '',
      marcadores: e.marcadores,
      publicado: e.publicado,
      data: dataExtenso(e.publicado),
      autor: AUTOR,
      capa: capa,
      capaCard: capa ? imgTamanho(capa, 900) : '',
      capaAlt: a.capa ? (a.capa.alt || e.titulo) : e.titulo,
      legenda: a.capa ? a.capa.legenda : '',
      linhaFina: a.linhaFina,
      corpo: a.corpo,
      leitura: a.leitura,
      busca: (e.titulo + ' ' + a.linhaFina + ' ' + e.marcadores.join(' ') + ' ' + e.html.replace(/<[^>]+>/g, ' ')).toLowerCase()
    };
  }

  var materiasPromise = null;
  function materias() {
    if (!materiasPromise) {
      materiasPromise = buscarFeed('posts').then(function (lista) {
        return lista.map(montarMateria).sort(function (a, b) { return a.publicado < b.publicado ? 1 : -1; });
      });
    }
    return materiasPromise;
  }

  /* editorias com pelo menos uma matéria publicada, em ordem alfabética */
  function editorias(lista) {
    var cont = {};
    lista.forEach(function (m) { m.marcadores.forEach(function (t) { cont[t] = (cont[t] || 0) + 1; }); });
    return Object.keys(cont).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (n) { return { nome: n, total: cont[n] }; });
  }

  /* ---------- Linha do tempo (Página "Linha do tempo" no Blogger) ---------- */
  // acentos combinantes (U+0300 a U+036F), montados por código para o arquivo ficar só em ASCII
  var ACENTOS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
  function semAcento(s) { return (s || '').normalize('NFD').replace(ACENTOS, ''); }
  function normal(s) { return semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  function linhaDoTempo() {
    return buscarFeed('pages').then(function (paginas) {
      var pg = paginas.filter(function (p) { return normal(p.titulo) === 'linha do tempo'; })[0];
      if (!pg) return null;
      var doc = new DOMParser().parseFromString('<div id="raiz">' + pg.html + '</div>', 'text/html');
      var raiz = doc.getElementById('raiz');
      limpar(raiz);
      embeds(raiz);

      var intro = [];
      var eventos = [];
      var atual = null;
      Array.prototype.slice.call(raiz.children).forEach(function (el) {
        var t = texto(el);
        var ehData = /^H[23]$/.test(el.nodeName) ||
          (el.nodeName === 'P' && t && t.length < 60 && el.querySelector('b,strong') && texto(el.querySelector('b,strong')) === t);
        if (ehData) { atual = { data: t, html: '' }; eventos.push(atual); }
        else if (atual) atual.html += el.outerHTML;
        else intro.push(el.outerHTML);
      });
      return { intro: intro.join(''), eventos: eventos };
    });
  }

  window.Blog = {
    materias: materias,
    editorias: editorias,
    linhaDoTempo: linhaDoTempo,
    imgTamanho: imgTamanho,
    semAcento: semAcento,
    analisar: analisar,
    esc: esc,
    BLOG: BLOG
  };
})();
