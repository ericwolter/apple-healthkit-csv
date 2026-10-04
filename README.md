# Apple Health XML to CSV converter

Browser-only converter, distinct from the HealthExportCSV iOS app. Develop it here; ericwolter.com hosts an imported release.

```sh
npm ci
npm run check
npm run build
```

The build produces `dist/index.html` and never writes into another project. Preview with `python3 -m http.server --directory dist 8080`.

After committing a tested release, run `npm run import-app -- apple-healthkit-csv <tag-or-commit>` in ericwolter.com. Review the complete website build and preview before publishing.

Keep real health exports private. Use synthetic data for tests. Packaging changes must preserve conversion behavior, tracking and appearance.
