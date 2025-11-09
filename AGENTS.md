# Repository Guidelines

## Project Structure & Module Organization
YM4cut is a TypeScript React app packaged for Electron. Core UI lives in `src/` with domain-specific components in `src/components/` and shared assets under `src/assets/`. The Electron main process sits in `public/electron.js`, with preload logic in `public/preload.js` for IPC bridging. Built artifacts land in `build/`, runtime composites are written to `output/`, and captured sessions persist under `captures/` for debugging and QA.

## Build, Test, and Development Commands
- `npm install` — install Node dependencies declared in `package.json`.
- `npm start` — run the CRA dev server on port 3000; used by the Electron dev loop.
- `npm run electron:start` — launch the dev server and Electron shell together via `concurrently`; primary workflow for feature work.
- `npm run build` — create the production React bundle in `build/`.
- `npm run electron:build` — package the Electron app (NSIS target) after a fresh `build`.
- `npm test` — execute Jest + React Testing Library suite in watch mode; append `-- --coverage` to measure coverage.

## Coding Style & Naming Conventions
Use the CRA defaults enforced by the `react-app` ESLint preset and Prettier formatting. Apply 2-space indentation and TypeScript extensions (`.tsx` for components, `.ts` for utilities). Name React components, Redux slices, and Electron handlers in PascalCase (`PhotoGrid.tsx`), hooks/functions in camelCase, and constants in SCREAMING_SNAKE. Co-locate component-specific styles as `Component.css`; keep global tokens in `src/App.css` or shared asset files.

## Testing Guidelines
Place tests next to the logic they cover as `*.test.tsx` or `*.test.ts`. Prefer React Testing Library patterns (`screen`, `userEvent`) and avoid implementation detail assertions. When covering Electron IPC, mock modules with `jest.mock('electron')` or adapt preload shims. Keep coverage trending upward (target ≥80% lines) and add smoke tests for new IPC handlers. Run `npm test -- --runInBand` before packaging to catch race conditions.

## Commit & Pull Request Guidelines
Write concise, imperative commit subjects (~50 chars) referencing the component or behavior (`Fix: restore load path`). Use English when possible for cross-team clarity and add body detail when touching build or IPC code. For pull requests, link issues, list test commands executed, and attach UI screenshots or sample output from `output/` when visuals change. Request review from desktop owners when modifying `public/electron.js`, packaging config, or printer/image pipelines.
