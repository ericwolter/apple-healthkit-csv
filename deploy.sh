#!/bin/sh

rm dist/*
npx html-inline -i src/index.html -o dist/index.inline.html
awk '/<\/head>/{print "<script async src=\"//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js\"></script>"}1' dist/index.inline.html > dist/index.ads.html
npx html-minifier -o dist/index.min.html -c htmlmin.json dist/index.ads.html
# cp index.min.html dist/health-export.html
