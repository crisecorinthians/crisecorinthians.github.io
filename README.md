# Crise Política do Corinthians

Portal jornalístico independente sobre a crise política, administrativa e financeira do Corinthians.
Trabalho de conclusão de curso de Leonardo Zelli · Jornalismo · Turma U8 · Universidade Presbiteriana Mackenzie.
Orientação: Prof. Dr. Anderson Gurgel.

Site: https://crisecorinthians.github.io

## Como funciona

As matérias são publicadas no Blogger (crisepoliticadocorinthians.blogspot.com) e o site as lê
automaticamente. Para publicar, não é preciso mexer neste repositório: siga o Manual de Publicação.

- `index.html`, `materias.html`, `materia.html`, `linha-do-tempo.html`, `sobre.html`: páginas
- `assets/js/blogger.js`: leitura do Blogger e conversão das postagens em matérias
- `assets/js/app.js`: navegação, animações, carrosséis e montagem das páginas
- `assets/css/style.css`: identidade visual e layout responsivo
- `_paginas/`: conteúdo das páginas internas; `bash _paginas/montar.sh` regenera as páginas
  a partir do cabeçalho e rodapé da `index.html`

Design e desenvolvimento: Rafael Dias.
