#!/usr/bin/env bash

if [ -d "dist/" ]; then 
  rm -Rf "dist/";
fi
mkdir "dist/"
npx html-inline -i src/index.html -o dist/index.inline.html
awk '/<head>/{print;print "<script async src=\"https://www.googletagmanager.com/gtag/js?id=UA-42589062-1\"></script>";next}1' dist/index.inline.html > dist/index.analytics.html
awk '/<\/head>/{print "<script async src=\"//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js\"></script>"}1' dist/index.analytics.html > dist/index.ads.html
mkdir "../dist/projects/apple-health-export"
npx html-minifier -o "../dist/projects/apple-health-export/index.html" -c htmlmin.json dist/index.ads.html
