## Quick start



1. Install dependencies

```bash
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
```

---

## Next steps I can do for you
- Add a `generate-project.sh` script that writes files directly and runs `npm install` so you can start immediately.
- Wire the two-CSV linking to auto-merge preview and validation steps.
- Add unit tests (Vitest) and linting (ESLint + Prettier) config.