/* ==========================================================================
   Interface: navegação, animações, carrosséis e montagem das páginas
   ========================================================================== */
(function () {
  'use strict';

  var esc = Blog.esc;
  var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var ICONE = {
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    prox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- transição de página ---------- */
  function iniciarTransicoes() {
    requestAnimationFrame(function () { document.body.classList.add('pronto'); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) document.body.classList.remove('saindo'); document.body.classList.add('pronto'); });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a || semMovimento || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/.test(href) || a.hasAttribute('download')) return;
      e.preventDefault();
      document.body.classList.add('saindo');
      setTimeout(function () { window.location.href = href; }, 200);
    });
  }

  /* ---------- navegação ---------- */
  function iniciarNav() {
    var nav = $('.nav');
    if (!nav) return;
    var aoRolar = function () { nav.classList.toggle('solida', window.scrollY > 40); };
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });

    var btn = $('.menu-btn');
    if (btn) btn.addEventListener('click', function () {
      var aberto = document.body.classList.toggle('menu-aberto');
      btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      btn.innerHTML = aberto ? ICONE.fechar : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>';
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) btn.click(); });
  }

  /* ---------- animação de entrada na rolagem ---------- */
  var observador = null;
  function revelar(raiz) {
    var els = $$('[data-reveal]:not(.in)', raiz);
    if (semMovimento || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    if (!observador) {
      observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); observador.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    }
    els.forEach(function (el) { observador.observe(el); });
    conferirVisiveis();
  }
  // segunda garantia: o texto nunca pode ficar invisível. Na rolagem, tudo o
  // que já entrou na tela (ou ficou acima dela) é revelado.
  var conferindo = false;
  function conferirVisiveis() {
    if (conferindo) return;
    conferindo = true;
    requestAnimationFrame(function () {
      conferindo = false;
      var limite = window.innerHeight * 0.96;
      $$('[data-reveal]:not(.in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < limite) { el.classList.add('in'); if (observador) observador.unobserve(el); }
      });
    });
  }
  window.addEventListener('scroll', conferirVisiveis, { passive: true });
  window.addEventListener('resize', conferirVisiveis);
  window.addEventListener('load', conferirVisiveis);

  /* ---------- carrossel: setas, arraste com mouse e encaixe suave ---------- */
  function carrossel(caixa, opcoes) {
    opcoes = opcoes || {};
    var trilho = $('.trilho', caixa);
    if (!trilho) return;
    var ant = document.createElement('button');
    var prox = document.createElement('button');
    ant.className = 'seta seta-ant'; ant.setAttribute('aria-label', 'Anterior'); ant.innerHTML = ICONE.ant;
    prox.className = 'seta seta-prox'; prox.setAttribute('aria-label', 'Próxima'); prox.innerHTML = ICONE.prox;
    caixa.appendChild(ant); caixa.appendChild(prox);

    function passo() {
      var item = trilho.children[0];
      if (!item) return trilho.clientWidth;
      var gap = parseFloat(getComputedStyle(trilho).columnGap) || 0;
      return opcoes.pagina ? trilho.clientWidth : item.getBoundingClientRect().width + gap;
    }
    function atualizar() {
      var max = trilho.scrollWidth - trilho.clientWidth - 2;
      ant.disabled = trilho.scrollLeft <= 2;
      prox.disabled = trilho.scrollLeft >= max;
      if (opcoes.aoMudar) opcoes.aoMudar(Math.round(trilho.scrollLeft / Math.max(1, passo())));
    }
    ant.addEventListener('click', function () { trilho.scrollBy({ left: -passo(), behavior: semMovimento ? 'auto' : 'smooth' }); });
    prox.addEventListener('click', function () { trilho.scrollBy({ left: passo(), behavior: semMovimento ? 'auto' : 'smooth' }); });
    trilho.addEventListener('scroll', function () { window.requestAnimationFrame(atualizar); }, { passive: true });
    window.addEventListener('resize', atualizar);

    // arraste com o mouse (no toque, a rolagem nativa já tem inércia)
    var x0 = 0, s0 = 0, arrastou = false, ativo = false, v = 0, ultX = 0, ultT = 0;
    trilho.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      ativo = true; arrastou = false; x0 = ultX = e.clientX; s0 = trilho.scrollLeft; ultT = performance.now(); v = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!ativo) return;
      var dx = e.clientX - x0;
      if (!arrastou && Math.abs(dx) > 6) { arrastou = true; trilho.classList.add('arrastando'); }
      if (arrastou) {
        trilho.scrollLeft = s0 - dx;
        var t = performance.now(); v = (e.clientX - ultX) / Math.max(1, t - ultT); ultX = e.clientX; ultT = t;
      }
    });
    window.addEventListener('pointerup', function () {
      if (!ativo) return;
      ativo = false;
      if (!arrastou) return;
      // inércia: projeta o movimento e encaixa no card mais próximo
      var p = passo();
      var alvo = trilho.scrollLeft - v * 220;
      var idx = Math.round(alvo / p);
      trilho.classList.remove('arrastando');
      trilho.scrollTo({ left: idx * p, behavior: semMovimento ? 'auto' : 'smooth' });
      setTimeout(function () { arrastou = false; }, 0);
    });
    trilho.addEventListener('click', function (e) { if (arrastou) { e.preventDefault(); e.stopPropagation(); } }, true);
    trilho.addEventListener('dragstart', function (e) { e.preventDefault(); });

    atualizar();
    return { atualizar: atualizar };
  }

  /* ---------- lightbox ---------- */
  var lb = null;
  function lightbox(fotos, inicio) {
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.innerHTML = '<button class="icone-btn fechar" aria-label="Fechar">' + ICONE.fechar + '</button>' +
        '<button class="seta seta-ant" aria-label="Anterior">' + ICONE.ant + '</button><button class="seta seta-prox" aria-label="Próxima">' + ICONE.prox + '</button>' +
        '<img alt=""><p></p>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) { if (e.target === lb) fechar(); });
      $('.fechar', lb).addEventListener('click', fechar);
      document.addEventListener('keydown', function (e) {
        if (!lb.classList.contains('on')) return;
        if (e.key === 'Escape') fechar();
        if (e.key === 'ArrowLeft') ir(-1);
        if (e.key === 'ArrowRight') ir(1);
      });
      var tx = 0;
      lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1); });
      $('.seta-ant', lb).addEventListener('click', function () { ir(-1); });
      $('.seta-prox', lb).addEventListener('click', function () { ir(1); });
    }
    var i = inicio;
    function mostrar() {
      var f = fotos[i];
      $('img', lb).src = f.src; $('img', lb).alt = f.alt || '';
      $('p', lb).textContent = f.legenda || '';
      $('.seta-ant', lb).disabled = i === 0;
      $('.seta-prox', lb).disabled = i === fotos.length - 1;
    }
    function ir(d) { var n = i + d; if (n >= 0 && n < fotos.length) { i = n; mostrar(); } }
    function fechar() { lb.classList.remove('on'); document.documentElement.style.overflow = ''; }
    lb._ir = ir;
    mostrar();
    lb.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
  }

  function toast(msg) {
    var t = $('.toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast' }));
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ---------- cards ---------- */
  function capaHTML(m, comTag) {
    return '<div class="capa">' +
      (m.capaCard ? '<img src="' + esc(m.capaCard) + '" alt="' + esc(m.capaAlt) + '" loading="lazy">' : '') +
      (comTag && m.editoria ? '<span class="tag">' + esc(m.editoria) + '</span>' : '') + '</div>';
  }
  function cardVertical(m, i) {
    return '<a class="card card-v" href="' + m.url + '" data-reveal style="--d:' + (Math.min(i, 5) * 0.08) + 's">' +
      capaHTML(m, true) + '<h3>' + esc(m.titulo) + '</h3>' +
      '<p class="meta"><span>' + esc(m.data) + '</span><span>' + m.leitura + ' min de leitura</span></p></a>';
  }
  function cardHorizontal(m, i) {
    return '<a class="card card-h" href="' + m.url + '" data-reveal style="--d:' + ((i % 3) * 0.08) + 's">' +
      capaHTML(m, false) +
      (m.editoria ? '<span class="tag">' + esc(m.editoria) + '</span>' : '') +
      '<h3>' + esc(m.titulo) + '</h3>' +
      (m.linhaFina ? '<p class="linha-fina">' + esc(m.linhaFina) + '</p>' : '') +
      '<p class="meta"><span>' + esc(m.data) + '</span><span>' + m.leitura + ' min de leitura</span></p></a>';
  }
  function cardDestaque(m) {
    return '<a class="card card-h card-destaque" href="' + m.url + '" data-reveal>' +
      capaHTML(m, false) + '<div>' +
      (m.editoria ? '<span class="tag">' + esc(m.editoria) + '</span>' : '') +
      '<h2>' + esc(m.titulo) + '</h2>' +
      (m.linhaFina ? '<p class="linha-fina">' + esc(m.linhaFina) + '</p>' : '') +
      '<p class="meta"><span>' + esc(m.data) + '</span><span>' + m.leitura + ' min de leitura</span></p></div></a>';
  }
  function esqueletos(n, classe) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<div class="' + classe + ' esqueleto"><div class="capa"></div><div class="linha"></div><div class="linha"></div></div>';
    return s;
  }
  function falha(el, msg) { el.innerHTML = '<p class="aviso">' + (msg || 'Não foi possível carregar as matérias agora. Atualize a página em instantes.') + '</p>'; }

  /* ==========================================================================
     Páginas
     ========================================================================== */
  var paginas = {};

  paginas.home = function () {
    var caixa = $('#carrossel');
    var trilho = $('.trilho', caixa);
    trilho.innerHTML = esqueletos(4, 'card-v');
    Blog.materias().then(function (lista) {
      if (!lista.length) { falha(trilho, 'As primeiras matérias estão a caminho.'); return; }
      trilho.innerHTML = lista.slice(0, 10).map(cardVertical).join('');
      caixa.style.setProperty('--seta-top', ($('.capa', trilho).offsetHeight / 2) + 'px');
      carrossel(caixa);
      revelar(caixa);
    }).catch(function () { falha(trilho); });
  };

  paginas.materias = function () {
    var grade = $('#grade');
    var filtros = $('#filtros');
    var campo = $('#busca');
    var resumo = $('#resumo');
    var params = new URLSearchParams(location.search);
    var editoria = params.get('editoria') || '';
    campo.value = params.get('busca') || '';
    if (location.hash === '#busca') setTimeout(function () { campo.focus(); }, 400);
    grade.innerHTML = esqueletos(6, 'card-h');

    Blog.materias().then(function (lista) {
      var eds = Blog.editorias(lista);
      if (editoria && !eds.some(function (e) { return e.nome === editoria; })) editoria = '';
      filtros.innerHTML = '<button class="filtro" data-ed="">Todas</button>' +
        eds.map(function (e) { return '<button class="filtro" data-ed="' + esc(e.nome) + '">' + esc(e.nome) + '</button>'; }).join('');

      function desenhar() {
        var termo = campo.value.trim().toLowerCase();
        var termos = Blog.semAcento(termo).split(/\s+/).filter(Boolean);
        var achadas = lista.filter(function (m) {
          if (editoria && m.marcadores.indexOf(editoria) < 0) return false;
          if (!termos.length) return true;
          var base = Blog.semAcento(m.busca);
          return termos.every(function (t) { return base.indexOf(t) >= 0; });
        });
        $$('.filtro', filtros).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ed') === editoria ? 'true' : 'false'); });
        var partes = [];
        if (editoria) partes.push('em ' + editoria);
        if (termo) partes.push('para “' + campo.value.trim() + '”');
        resumo.textContent = achadas.length + (achadas.length === 1 ? ' matéria' : ' matérias') + (partes.length ? ' ' + partes.join(' ') : '');
        if (!achadas.length) { grade.innerHTML = '<p class="aviso">Nenhuma matéria encontrada. Tente outra palavra ou editoria.</p>'; return; }
        var destaque = !editoria && !termo;
        grade.innerHTML = achadas.map(function (m, i) { return destaque && i === 0 ? cardDestaque(m) : cardHorizontal(m, destaque ? i - 1 : i); }).join('');
        revelar(grade);
        var q = new URLSearchParams();
        if (editoria) q.set('editoria', editoria);
        if (termo) q.set('busca', campo.value.trim());
        history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
      }
      filtros.addEventListener('click', function (e) {
        var b = e.target.closest('.filtro');
        if (!b) return;
        editoria = b.getAttribute('data-ed');
        desenhar();
      });
      var timer;
      campo.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(desenhar, 160); });
      desenhar();
    }).catch(function () { falha(grade); });
  };

  paginas.materia = function () {
    var slug = new URLSearchParams(location.search).get('p') || '';
    var alvo = $('#materia');
    Blog.materias().then(function (lista) {
      var m = lista.filter(function (x) { return x.slug === slug || x.id === slug; })[0];
      if (!m) {
        alvo.innerHTML = '<section class="materia-topo"><div class="wrap"><a class="voltar" href="materias.html">' + ICONE.ant + 'Matérias</a>' +
          '<h1>Matéria não encontrada</h1><p class="linha-fina">Ela pode ter sido retirada do ar ou o link está incompleto.</p></div></section>';
        return;
      }
      document.title = m.titulo + ' · Crise Política do Corinthians';
      var desc = document.querySelector('meta[name="description"]');
      if (desc && m.linhaFina) desc.setAttribute('content', m.linhaFina);

      var url = location.href;
      var tw = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(m.titulo) + '&url=' + encodeURIComponent(url);
      var wa = 'https://wa.me/?text=' + encodeURIComponent(m.titulo + ' ' + url);
      var fb = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);

      alvo.innerHTML =
        '<section class="materia-topo"><div class="wrap">' +
          '<a class="voltar" href="materias.html" data-reveal>' + ICONE.ant + 'Matérias</a><br>' +
          (m.editoria ? '<a class="tag" href="materias.html?editoria=' + encodeURIComponent(m.editoria) + '" data-reveal style="--d:.05s">' + esc(m.editoria) + '</a>' : '') +
          '<h1 data-reveal style="--d:.1s">' + esc(m.titulo) + '</h1>' +
          (m.linhaFina ? '<p class="linha-fina" data-reveal style="--d:.18s">' + esc(m.linhaFina) + '</p>' : '') +
          '<p class="materia-meta" data-reveal style="--d:.26s"><span>Por <b>' + esc(m.autor) + '</b></span><span>' + esc(m.data) + '</span><span>' + m.leitura + ' min de leitura</span></p>' +
        '</div></section>' +
        (m.capa ? '<figure class="materia-capa" data-reveal style="--d:.3s"><img src="' + esc(m.capa) + '" alt="' + esc(m.capaAlt) + '">' +
          (m.legenda ? '<figcaption class="legenda">' + esc(m.legenda) + '</figcaption>' : '') + '</figure>' : '') +
        '<div class="corpo">' + m.corpo + '</div>' +
        '<div class="compartilhar"><span>Compartilhar</span>' +
          '<a class="btn-redondo" href="' + wa + '" target="_blank" rel="noopener" aria-label="Compartilhar no WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.4z"/></svg></a>' +
          '<a class="btn-redondo" href="' + tw + '" target="_blank" rel="noopener" aria-label="Compartilhar no X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5z"/></svg></a>' +
          '<a class="btn-redondo" href="' + fb + '" target="_blank" rel="noopener" aria-label="Compartilhar no Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v1.9H8v3.2h2.6V22H14v-10.3h2.6l.4-3.2H14z"/></svg></a>' +
          '<button class="btn-redondo" id="copiar" aria-label="Copiar link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></button>' +
        '</div>';

      // galerias, ampliação de fotos e animações do corpo
      $$('.corpo > *', alvo).forEach(function (el) { el.setAttribute('data-reveal', ''); });
      $$('[data-galeria]', alvo).forEach(function (g) {
        var figs = $$('figure', g);
        var fotos = figs.map(function (f) { var im = $('img', f); var c = $('figcaption', f); return { src: im.src, alt: im.alt, legenda: c ? c.textContent : '' }; });
        var tr = document.createElement('div'); tr.className = 'trilho';
        figs.forEach(function (f, i) { var c = $('figcaption', f); if (c) c.remove(); tr.appendChild(f); $('img', f).addEventListener('click', function () { lightbox(fotos, i); }); });
        g.appendChild(tr);
        var rod = document.createElement('div'); rod.className = 'galeria-rodape';
        rod.innerHTML = '<span class="galeria-leg"></span><span class="galeria-cont"></span>';
        g.parentNode.insertBefore(rod, g.nextSibling);
        carrossel(g, { pagina: true, aoMudar: function (i) {
          i = Math.min(fotos.length - 1, Math.max(0, i));
          $('.galeria-leg', rod).textContent = fotos[i].legenda;
          $('.galeria-cont', rod).textContent = (i + 1) + ' / ' + fotos.length;
        } });
      });
      $$('.corpo > figure img', alvo).forEach(function (im) {
        im.addEventListener('click', function () { var c = im.parentNode.querySelector('figcaption'); lightbox([{ src: im.src, alt: im.alt, legenda: c ? c.textContent : '' }], 0); });
      });
      $('#copiar').addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Link copiado'); }, function () { toast(url); });
      });
      revelar(alvo);

      // progresso de leitura
      var barra = $('.progresso');
      var corpo = $('.corpo', alvo);
      function prog() {
        var r = corpo.getBoundingClientRect();
        var total = r.height - window.innerHeight * 0.6;
        var p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
        barra.style.transform = 'scaleX(' + p + ')';
      }
      window.addEventListener('scroll', prog, { passive: true });
      prog();

      // leia também: mesma editoria primeiro, depois as mais recentes
      var outras = lista.filter(function (x) { return x !== m; });
      var rel = outras.filter(function (x) { return x.editoria && x.editoria === m.editoria; })
        .concat(outras.filter(function (x) { return !x.editoria || x.editoria !== m.editoria; })).slice(0, 3);
      var sec = $('#relacionadas');
      if (rel.length) {
        sec.hidden = false;
        $('.grade', sec).innerHTML = rel.map(cardHorizontal).join('');
        revelar(sec);
      }
    }).catch(function () { falha(alvo); });
  };

  paginas.linha = function () {
    var lista = $('#tl');
    var intro = $('#tl-intro');
    Blog.linhaDoTempo().then(function (r) {
      if (!r || !r.eventos.length) { lista.outerHTML = '<p class="tl-vazio">A linha do tempo está sendo preparada. Volte em breve.</p>'; return; }
      if (r.intro) intro.innerHTML = r.intro;
      lista.innerHTML = '<div class="tl-linha"></div><div class="tl-linha-cheia"></div>' + r.eventos.map(function (ev, i) {
        return '<div class="tl-item" data-reveal><span class="tl-ponto"></span><div class="tl-data">' + esc(ev.data) + '</div><div class="tl-texto">' + ev.html + '</div></div>';
      }).join('');
      revelar(lista);
      var cheia = $('.tl-linha-cheia', lista);
      var itens = $$('.tl-item', lista);
      function desenhar() {
        var r = lista.getBoundingClientRect();
        var meio = window.innerHeight * 0.6;
        var p = Math.min(1, Math.max(0, (meio - r.top) / Math.max(1, r.height)));
        cheia.style.transform = 'scaleY(' + p + ')';
        itens.forEach(function (it) { it.classList.toggle('aceso', it.getBoundingClientRect().top < meio); });
      }
      window.addEventListener('scroll', desenhar, { passive: true });
      window.addEventListener('resize', desenhar);
      desenhar();
    }).catch(function () { lista.outerHTML = '<p class="tl-vazio">Não foi possível carregar a linha do tempo agora. Atualize a página em instantes.</p>'; });
  };

  /* ---------- início ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    iniciarTransicoes();
    iniciarNav();
    var pg = document.body.getAttribute('data-page');
    if (paginas[pg]) paginas[pg]();
    revelar(document);
  });
})();
