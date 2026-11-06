#!/usr/bin/env bash
# Monta as páginas internas a partir da index.html (cabeçalho, menu e rodapé
# iguais em todo o site). Cada arquivo em _paginas/ traz só o <main> da página
# e 4 linhas de configuração no topo (title, desc, page, nav).
# Uso: bash _paginas/montar.sh   (a partir da raiz do site)
set -euo pipefail
cd "$(dirname "$0")/.."

topo=$(sed -n '1,/^<main>/p' index.html | sed '$d')
base=$(sed -n '/^<footer/,$p' index.html)

for f in _paginas/*.html; do
  nome=$(basename "$f")
  titulo=$(sed -n 's/^<!--title: \(.*\)-->$/\1/p' "$f")
  desc=$(sed -n 's/^<!--desc: \(.*\)-->$/\1/p' "$f")
  pagina=$(sed -n 's/^<!--page: \(.*\)-->$/\1/p' "$f")
  nav=$(sed -n 's/^<!--nav: \(.*\)-->$/\1/p' "$f")
  conteudo=$(sed '/^<!--\(title\|desc\|page\|nav\): .*-->$/d' "$f")

  t=$(printf '%s\n' "$topo" \
    | sed "s|<title>.*</title>|<title>$titulo</title>|" \
    | sed "s|<meta name=\"description\" content=\"[^\"]*\">|<meta name=\"description\" content=\"$desc\">|" \
    | sed "s|<meta property=\"og:title\" content=\"[^\"]*\">|<meta property=\"og:title\" content=\"$titulo\">|" \
    | sed "s|<meta property=\"og:description\" content=\"[^\"]*\">|<meta property=\"og:description\" content=\"$desc\">|" \
    | sed "s|<body class=\"home\" data-page=\"home\">|<body data-page=\"$pagina\">|" \
    | sed 's| aria-current="page"||')
  if [ -n "$nav" ]; then
    t=$(printf '%s\n' "$t" | sed "s|<a href=\"$nav\">|<a href=\"$nav\" aria-current=\"page\">|g")
  fi

  saida=$(printf '%s\n\n%s\n\n%s\n' "$t" "$conteudo" "$base")
  # a 404 é servida em qualquer endereço: caminhos precisam ser absolutos
  if [ "$nome" = "404.html" ]; then
    saida=$(printf '%s\n' "$saida" | sed -E 's#(href|src)="(assets/|index\.html|materias\.html|linha-do-tempo\.html|sobre\.html)#\1="/\2#g')
  fi
  printf '%s\n' "$saida" > "$nome"
  echo "ok  $nome"
done
