#!/bin/sh
# Build the single-file website (used for hosting) and inject the download/dialog compatibility shim.
set -e
npx vite build -c vite.single.config.ts
python3 - <<'PY'
p='dist-single/index.html'
h=open(p,encoding='utf8').read()
s=open('shim.html',encoding='utf8').read()
if 'blobs=new Map()' not in h:
    h=h.replace('<head>','<head>\n'+s,1)
open(p,'w',encoding='utf8').write(h)
print('shim injected')
PY
