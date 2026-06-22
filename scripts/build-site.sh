#!/usr/bin/env bash
# Empacota SÓ o frontend em dist/ para publicar em host estático (GitHub Pages /
# Cloudflare), EXCLUINDO o backend (apps-script/), docs/ e test/ — assim o código
# do servidor não vai ao ar. Não há transpile/bundle (o app é vanilla ES modules):
# isto é apenas uma cópia.
#
# Uso local / Wrangler:           bash scripts/build-site.sh
# Cloudflare Pages (Git):  Build command = bash scripts/build-site.sh
#                          Build output  = dist
# GitHub Pages (Actions):  ver .github/workflows/pages.yml (publica dist/).
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist
cp index.html dist/
cp -R src dist/
cp _headers dist/

# Fallback de SPA para hosts estáticos sem reescrita própria (o GitHub Pages serve
# 404.html para qualquer caminho sem arquivo). Sendo cópia do index, links diretos
# como /obras e /publico/:token bootam o app e o roteador resolve a rota.
cp index.html dist/404.html

echo "dist/ pronto (somente frontend):"
ls -1 dist
