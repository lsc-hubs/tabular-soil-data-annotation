## Quick start

An app to annotate CSV soil observation data with relevant column metadata.

View online at [lsc-hubs.github.io](http://lsc-hubs.github.io/tabular-soil-data-annotation/)

## Deploy locally

1. Clone repository and Install dependencies

```bash
git clone http://github.com/lsc-hubs/tabular-soil-data-annotation
cd tabular-soil-data-annotation
npm install
```

2. Run dev server

```bash
npm run dev
```

3. Open http://localhost:5173

Notes:
- The app uses papaparse for CSV parsing and xlsx (SheetJS) for Excel files.
- Vuetify 3 is used for UI components. If you need SSR or advanced Vuetify configuration, add the recommended Vuetify setup (theme, a-la-carte imports, etc.).
