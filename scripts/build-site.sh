#!/usr/bin/env bash
# Empacota SÓ o frontend em dist/ para publicar no Cloudflare Pages, EXCLUINDO o
# backend (apps-script/), docs/ e test/ — assim o código do servidor não vai ao ar.
# Não há transpile/bundle (o app é vanilla ES modules): isto é apenas uma cópia.
#
# Uso local / Wrangler:           bash scripts/build-site.sh
# Cloudflare Pages (Git):  Build command = bash scripts/build-site.sh
#                          Build output  = dist
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist
cp index.html dist/
cp -R src dist/
cp _headers dist/

echo "dist/ pronto (somente frontend):"
ls -1 dist
