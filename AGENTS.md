# Converter instructions

- This repository owns the browser converter, separate from the health-export-csv iOS project.
- Build only into the ignored local `dist/`. Do not write into ericwolter.com or edit its imported release.
- Preserve appearance and conversion behavior unless requested. Use synthetic test records; never publish personal health exports.
- Run `npm ci`, `npm run check` and `npm run build` before release. The website imports a committed version explicitly.
