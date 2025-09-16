### Overview

- **Tech stack**: Svelte 5 (runes, e.g., `$state`), TypeScript, Vite, ESM (`"type": "module"`), vite-preprocess. No SvelteKit; plain Vite apps.
- **Methodology**: Small, self-contained SPAs per game/tool; simple state containers using Svelte runes; component-first UI; explicit keyboard/action mapping; lightweight type-only model definitions; zero routing; deployable to subpaths with `base` config.

### Project-by-project breakdown

#### echo
- **Purpose**: Puzzle gameplay UI.
- **Structure**
  - `src/main.ts`: Mounts `App` into `#app`.
  - `src/App.svelte`: Shell; renders `Board`.
  - `src/components/`: Gameplay UI units:
    - `Board.svelte`, `BoardClue.svelte`, `Input.svelte`, `Keyboard.svelte`.
  - `src/lib/`:
    - `state.svelte.ts`: Centralized game state using `$state`.
    - `actions.ts`: Enumerated action codes for input handling.
  - `src/types/`: Type declarations (`actions.d.ts`, `puzzle.d.ts`, `svelte.d.ts`).
  - `src/app.css`: Global styles.
  - `public/`: Static assets (favicons, logo, script.js).
- **Build/config**
  - `svelte.config.js`: `vitePreprocess()`.
  - `vite.config.ts`: `base` set to `'/echo/'` in production; `svelte()` plugin.
  - `tsconfig.*.json`: Split app/node configs; `@tsconfig/svelte`.
  - `scripts`: `dev`, `build`, `preview`, `check`, plus `convert` (`scripts/convert.cjs`).
- **Notes**
  - Uses Svelte 5 runes (`$state`) for reactive, global-ish store colocated with logic helpers (tree traversal, render helpers).
  - Explicit action constants simplify keyboard/controller handling across components.

#### echo-editor
- **Purpose**: In-browser puzzle editor UI for Echo.
- **Structure**
  - `src/main.ts`: Mounts `App`.
  - `src/App.svelte`: Shell; renders `Editor`.
  - `src/components/`: Editor UI units:
    - `Editor.svelte`, `EditorClue.svelte`, `Placeholder.svelte`.
  - `src/lib/`: `convert.ts`, `editable.ts` for editing/transforms; type-only `types/puzzle.d.ts`.
  - `src/app.css`: Global styles.
  - `public/`: Static assets.
- **Build/config**
  - `vite.config.ts`: Default base; `svelte()` plugin.
  - `svelte.config.js`: `vitePreprocess()`.
  - `tsconfig.*.json`: Same pattern as others.
- **Notes**
  - Same SPA pattern with a distinct `components` namespace focused on editing rather than play.
  - Slightly newer Svelte/Vite versions but compatible.

#### typo
- **Purpose**: Typo word game UI and solver.
- **Structure**
  - `src/main.ts`: Mounts `App`.
  - `src/App.svelte`: Imports `Nav`, `Board`, `Definition`; renders game layout and logo.
  - `src/lib/`: Gameplay UI (`Board.svelte`, `Definition.svelte`, `Nav.svelte`, `Word.svelte`).
  - `src/state.svelte.ts`: Central game state via `$state`.
  - `src/solver.ts`: A* search implementation for word-ladder-like solutions; pure TS module.
  - `src/app.css`: Global styles.
  - `public/`: Assets, fonts, `words.json` content, computed dictionary.
- **Build/config**
  - `vite.config.ts`: `base` set to `'/typo/'` in prod.
  - `svelte.config.js`: `vitePreprocess()`.
  - `tsconfig.*.json`: Standard Svelte TS setup.
- **Notes**
  - Separation of UI (`lib/`) and algorithm (`solver.ts`) with a thin state layer (`state.svelte.ts`).
  - Assets and content under `public/` for direct serving/import (`/img/logo-typo.svg`).

### Cross-cutting conventions and methodology

- **App bootstrapping**
  - Entrypoint uses `mount` from Svelte 5:
    ```ts
    import { mount } from 'svelte'
    import './app.css'
    import App from './App.svelte'

    const app = mount(App, { target: document.getElementById('app')! })
    export default app
    ```
  - Single root component (`App.svelte`), no routing.

- **State management**
  - Svelte 5 runes with `$state` for a central, mutable store-like object:
    ```ts
    // state.svelte.ts
    export const game = $state({ /* model fields */ })
    ```
  - Colocate traversal/selector helpers with the state for tree-like data.
  - Keep types in `src/types/*.d.ts` and import in state and components.

- **Actions and input**
  - Enumerate input actions in a dedicated module, referenced by UI components and keyboard handlers:
    ```ts
    export const actions = { NOOP: -1, CHAR: 0, BACK: 1, PREV: 2, NEXT: 3, LEFT: 4, RIGHT: 5, REVEAL: 6 }
    ```

- **Components**
  - Game UI under `src/components` or `src/lib` depending on project; consistent naming: `Board`, `Keyboard`, `Definition`, `Nav`, `Editor`.
  - Keep `App.svelte` minimal; it composes feature components and high-level layout.

- **Styling**
  - Global stylesheet at `src/app.css`; component styles embedded where local styles are needed.
  - No CSS frameworks.

- **Build and TS**
  - Vite with `@sveltejs/vite-plugin-svelte`.
  - `svelte.config.js` uses `vitePreprocess()` only.
  - `scripts`: `dev`, `build`, `preview`, `check` (`svelte-check` + `tsc -p tsconfig.node.json`).
  - ESM `"type": "module"`.

- **Static assets and base path**
  - Static files in `public/`; referenced with root paths (e.g., `/img/...`) or imported.
  - Subpath deployment via `vite.config.ts` `base` switch on `NODE_ENV` for apps deployed under a subdirectory.

### Template/spec to generate similar projects

- **Directory layout**
  - Create:
    - `public/` for assets.
    - `src/` with:
      - `main.ts`, `app.css`, `App.svelte`
      - `components/` or `lib/` for feature components
      - `lib/` for `state.svelte.ts`, domain helpers, and algorithms
      - `types/` for `.d.ts` files (models, svelte/env)
    - `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `package.json`, `README.md`.

- **package.json**
  ```json
  {
    "name": "project-name",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview",
      "check": "svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json"
    },
    "devDependencies": {
      "@sveltejs/vite-plugin-svelte": "^5.0.3",
      "@tsconfig/svelte": "^5.0.4",
      "svelte": "^5.20.0",
      "svelte-check": "^4.1.0",
      "typescript": "~5.7.0",
      "vite": "^6.2.0"
    }
  }
  ```

- **svelte.config.js**
  ```js
  import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

  export default {
    preprocess: vitePreprocess(),
  }
  ```

- **vite.config.ts**
  ```ts
  import { defineConfig } from 'vite'
  import { svelte } from '@sveltejs/vite-plugin-svelte'

  // Adjust 'project-base' to your subpath if deploying under a subdirectory
  export default defineConfig({
    base: process.env.NODE_ENV === 'production' ? '/project-base/' : './',
    plugins: [svelte()],
  })
  ```

- **src/main.ts**
  ```ts
  import { mount } from 'svelte'
  import './app.css'
  import App from './App.svelte'

  const app = mount(App, { target: document.getElementById('app')! })
  export default app
  ```

- **src/App.svelte**
  ```svelte
  <script lang="ts">
    import MainView from './components/MainView.svelte'
  </script>

  <MainView />
  ```

- **src/lib/state.svelte.ts**
  ```ts
  // Define your domain model types in src/types/*.d.ts and import them here
  export const appState = $state({
    // fields...
  })

  // Optional: selectors/helpers colocated with state
  export function someSelector() { /* ... */ }
  ```

- **src/lib/actions.ts**
  ```ts
  export const actions = {
    NOOP: -1,
    CHAR: 0, BACK: 1,
    PREV: 2, NEXT: 3,
    LEFT: 4, RIGHT: 5,
    REVEAL: 6,
  }
  ```

- **src/types/puzzle.d.ts (example)**
  ```ts
  export type Clue = { text: string; clues?: number[] }
  export type Puzzle = { id: string; name: string; author: string; date: string; clues: Clue[] }
  export type State = number[]
  ```

- **tsconfig.app.json**
  ```json
  {
    "extends": "@tsconfig/svelte/tsconfig.json",
    "compilerOptions": {
      "types": ["svelte", "vite/client"]
    },
    "include": ["src/**/*"]
  }
  ```

- **tsconfig.node.json**
  ```json
  {
    "compilerOptions": {
      "composite": true,
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "skipLibCheck": true
    },
    "include": ["vite.config.ts", "svelte.config.js"]
  }
  ```

- **index.html (root)**
  ```html
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Project</title>
    </head>
    <body>
      <div id="app"></div>
      <script type="module" src="/src/main.ts"></script>
    </body>
  </html>
  ```

- **Conventions to follow**
  - Keep `App.svelte` minimal; delegate logic to feature components.
  - Use `$state` for shared, reactive state; colocate traversal/selector functions.
  - Centralize action codes; handle keyboard events at component boundaries.
  - Place algorithms/domain logic in `src/lib/*.ts` separate from UI components.
  - Keep static assets in `public/`; reference with absolute paths or imports.
  - Set `vite.config.ts` `base` if deploying under a subpath (e.g., GitHub Pages).
  - Run `npm run check` in CI to typecheck Svelte and TS.

- **Optional utilities**
  - Add project-specific scripts under `scripts/` (e.g., data conversion) and expose with `npm run` as in `echo`’s `convert`.

- **Versioning**
  - Keep Svelte and Vite versions aligned across sibling projects unless a feature in a single app requires newer versions; minor skew is acceptable.

- **Deployment**
  - Use static hosting; `vite build` outputs to `dist/`.
  - Ensure `base` matches the hosting path; verify asset references use the correct root or relative path strategy.

- **Testing**
  - Current repos don’t include tests; if adding, prefer DOM/component tests with `@testing-library/svelte` and keep pure functions (e.g., solvers) unit-tested in isolation.

- **Accessibility**
  - Keyboard-first design is implied by action mapping; ensure focus management is explicit (track focused inputs as in `echo`’s `state.svelte.ts`).

- **Performance**
  - Keep algorithmic modules pure and independent (e.g., `solver.ts`) to enable future web worker offloading if needed.

- **Documentation**
  - Minimal README with logo reference; optional to include template notes if using Vite+Svelte starter.

- **File naming**
  - PascalCase for components, kebab or lowerCamel for non-components; `.svelte.ts` for rune-state files signals Svelte-specific behavior.

- **Static typing**
  - Keep domain types in `types/*.d.ts` and import them in state and components; this keeps TS friction low and avoids runtime code in types.

- **Asset imports**
  - Import images directly in components when needed:
    ```svelte
    <script lang="ts">
      import logo from '/img/logo.svg'
    </script>
    <img src="{logo}" alt="Logo">
    ```

- **Navigation and layout**
  - Use simple flexbox layouts in `App.svelte` and component-local styles for small adjustments.

- **Data model (tree-based puzzles)**
  - Represent puzzles as nodes with optional `clues: number[]`.
  - Provide helpers to traverse (`prev`, `next`, `lmcc`, `rmcc`) and render (`render`) based on solved state.

- **Focus/input grid handling**
  - Track an `inputs: Array<Array<HTMLInputElement|undefined>>` in state and expose `input(idx, pos)` to retrieve active inputs for imperative focus control.

- **Internationalization**
  - Not present; if needed, keep it minimal and config-free (static JSON, simple formatter functions).

- **Security**
  - No network calls present; keep everything static or import JSON from `public/`.

- **Licensing**
  - Not specified; adopt per-repo standard as needed.

- **CI/CD**
  - Not present; if adding, run `npm ci`, `npm run check`, `npm run build`.

- **When to choose this pattern**
  - Small, static, interactive games or tools where SvelteKit routing/SSR is unnecessary.
  - Single-view SPAs requiring fast iteration and minimal boilerplate.

- **When to consider SvelteKit**
  - Multi-page apps, routing needs, server rendering, adapters, or API integration.

- **Quick start checklist**
  - Initialize from template above.
  - Define domain types in `src/types`.
  - Create `state.svelte.ts` with `$state`.
  - Add `actions.ts`.
  - Build feature components in `src/components` or `src/lib`.
  - Add static assets to `public/`.
  - Configure `vite.config.ts` `base` if deploying under subpaths.
  - `npm run dev` to develop; `npm run check` for typing; `npm run build` to release.

- **Sample algorithm module pattern**
  ```ts
  // src/lib/solver.ts
  export function solve(input: DomainInput): DomainOutput {
    // pure function, no Svelte dependencies
  }
  ```

- **Keyboard handling pattern (component snippet)**
  ```svelte
  <script lang="ts">
    import { actions } from '../lib/actions'
    import { appState } from '../lib/state.svelte'
    function onKeydown(e: KeyboardEvent) {
      // map e.key to actions.* and update appState accordingly
    }
  </script>

  <div tabindex="0" on:keydown={onKeydown}>
    <!-- UI -->
  </div>
  ```

- **State selector pattern**
  ```ts
  // src/lib/state.svelte.ts
  export function isLeaf(idx: number): boolean { /* ... */ }
  export function next(idx: number, from?: number): number|null { /* ... */ }
  ```

- **Deployment note**
  - For GitHub Pages under `/games/<project>/`, set `base: '/<project>/'` in Vite and ensure asset paths use leading `/` or import semantics.

- **Reproducibility**
  - Lock versions or ranges similar to current repos (Svelte 5.20–5.28, Vite 6.2–6.3); keep consistent across sibling apps for easier maintenance.

- **Asset pipeline**
  - Keep fonts in `public/fonts`, images in `public/img`, content JSON in `public/`. Reference via `/` paths or import.

- **Accessibility and UX**
  - Maintain focus index in state for keyboard navigation; provide visual focus cues; ensure logical tab/focus order with your input grid.

- **Performance posture**
  - Prefer immutable-like updates inside `$state` where feasible; keep recomputation inside small helpers/selectors; avoid heavyweight libraries.

- **Documentation**
  - Add a minimal README with logo header; include controls and rules screenshots if applicable.

- **Example content bundling**
  - For datasets (puzzles), place JSON under `src/assets` for bundling or `public/` for runtime fetch, depending on size and change frequency.

- **Testing scaffold (optional)**
  ```bash
  npm i -D vitest @testing-library/svelte jsdom
  ```
  - Pure TS modules: `vitest`.
  - Components: `@testing-library/svelte`.

- **Monorepo consideration**
  - These projects live side-by-side; if scaling, consider pnpm workspaces to dedupe deps and share types/components.

- **Consistent naming**
  - Use `components/` for UI only; `lib/` for state, helpers, algorithms. Keep component names PascalCase, libs camelCase.

- **Editor counterpart guideline**
  - Use `Editor.svelte`, `EditorClue.svelte`, and modular helpers like `editable.ts`, `convert.ts`. Preserve the same state structure and types as the game to simplify round-trips.

- **Production flags**
  - Rely on `NODE_ENV` from Vite; no custom environment handling needed for these static apps.

- **Fonts and theming**
  - Serve fonts from `public/fonts`; define base typography in `src/app.css`; keep component-local styles scoped.

- **Static content imports**
  - If referencing images with `/img/...`, ensure they exist in `public/img`. For hashed builds, prefer `import logo from '/img/...';`.

- **Inter-project alignment**
  - Keep `tsconfig` and `svelte.config.js` identical to reduce friction switching between repos.

- **Differences to avoid**
  - Don’t introduce routing or SSR unless needed.
  - Don’t introduce global store libraries; `$state` suffices for these sizes.

- **Security posture**
  - No remote fetches; if added, validate inputs and sanitize rendered content.

- **Version strategy**
  - Use compatible minor versions of Svelte/Vite across all apps; test builds after upgrades.

- **Local dev**
  - `npm run dev` on each app separately; ports auto-assigned by Vite.

- **Build artifacts**
  - `dist/` folder per app; can be published to static hosting.

- **GitHub Pages note**
  - If deploying multiple apps under the same domain, ensure each app has a unique `base` and is uploaded to the corresponding subdirectory.

- **Data conversion**
  - Keep any one-off data transformations under `scripts/` and expose with npm scripts.

- **Typing hygiene**
  - Keep `.d.ts` ambient types for domain models to reduce import friction. Include `svelte` and `vite/client` types in app tsconfig.

- **Error handling**
  - Keep UI resilient: guard against missing nodes, null inputs; prefer null-returning helpers (see `input()` helper pattern).

- **State-driven render**
  - Derive render strings from state traversal helpers (`render(idx)`) instead of duplicating logic in components.

- **Algorithm isolation**
  - Keep solvers pure and reusable (as in `typo/src/solver.ts`) to facilitate testing and potential workerization later.

- **File colocation**
  - Colocate helpers with `state.svelte.ts` when strongly tied to domain state; place general-purpose helpers in separate libs.

- **Focus management**
  - Maintain a focused index object in state (`{ clue, input }`) and expose imperative `input(idx, pos)` to retrieve DOM refs when necessary.

- **Accessibility**
  - Use `tabindex="0"` wrappers and explicit `on:keydown` for keyboard navigation; narrate state changes visually.

- **Logging and debugging**
  - Keep console usage minimal; rely on TypeScript and Svelte dev tools.

- **Internationalization**
  - Not part of current scope; if needed, use simple key/value JSON and a tiny formatter.

- **Analytics**
  - Not present; add as needed with care for privacy.

- **Licenses and credits**
  - Place any third-party font/image licenses in `public/` or `README.md`.