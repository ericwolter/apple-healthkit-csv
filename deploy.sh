#!/usr/bin/env bash

if [ -d "dist/" ]; then 
  rm -Rf "dist/";
fi
mkdir "dist/"
npx html-inline -i src/index.html -o dist/index.inline.html --ignore-external
awk '/<head>/{print;print "<script async src=\"https://www.googletagmanager.com/gtag/js?id=UA-42589062-1\"></script>";next}1' dist/index.inline.html > dist/index.analytics.html
mkdir "../dist/projects/apple-health-export"
npx html-minifier -o "../dist/projects/apple-health-export/index.html" -c htmlmin.json dist/index.analytics.html
