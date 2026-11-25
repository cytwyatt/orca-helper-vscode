# AGENTS.md

Instructions and engineering guidelines for AI coding agents working in `orca-helper-vscode` (**ORCA 6 Helper**).

## Project Overview

**ORCA 6 Helper** is a self-contained, offline-first VS Code extension for **ORCA 6** (6.0 / 6.1) quantum chemistry workflows. It provides:

- Language intelligence for ORCA input files (`.inp`): TextMate syntax highlighting, context-aware completions, hover documentation (including 0-based atom index lookup on coordinate lines), snippets, and real-time diagnostics.
- Parsing and navigation for `.inp`, `.out` / `.orcaout` / `.log`, `.xyz` / `*_trj.xyz`, `.hess`, and `.engrad` files via Document Symbols, Activity Bar views (Outline/TOC, Job Summary, Workspace Files), and status bar indicators.
- An interactive Webview (`OrcaViewerPanel`) for 3D molecular/trajectory visualization (`3Dmol.js`), measurements, normal-mode vibrational animations, convergence plots, and simulated IR / UV-Vis spectra (`Chart.js`).

Target environment: **VS Code `^1.85.0`**, **Node.js `>=18`** (dev/build tested on Node 20+), fully offline and **Remote-SSH** compatible.

---

## Setup & Commands

```bash
# Install dev dependencies
npm install

# Type-check TypeScript sources (strict mode, no emit)
npm run typecheck

# Copy vendor assets (3Dmol.js, Chart.js) and bundle extension via esbuild
npm run compile

# Rebuild automatically on file changes
npm run watch

# Bundle parsers and run unit/regression tests
npm test

# Build and package a .vsix archive
npm run package
```

Always run `npm run typecheck && npm test` (and `npm run compile` when changing extension/build code) before finishing a task.

---

## Repository Structure

```text
.
├── package.json                      # Extension manifest, contributions, settings, scripts
├── language-configuration.json       # Comment, bracket, and folding rules for orca-input
├── tsconfig.json                     # Strict TypeScript config (type-checking only; esbuild compiles)
├── .vscodeignore                     # Files excluded from the packaged .vsix
├── scripts/
│   ├── build.mjs                     # Copies 3Dmol/Chart.js to media/vendor/ & bundles src/extension.ts
│   └── run-tests.mjs                 # Bundles src/parsers/index.ts and runs node:assert/strict tests
├── src/
│   ├── extension.ts                  # Extension activation, commands, parse cache, event wiring
│   ├── data/
│   │   ├── elements.ts               # Periodic table (Z=1..118), lookupElement(), Hill computeFormula()
│   │   └── orca6Keywords.ts          # ORCA 6 simple keywords, %blocks, parameters, solvents, deprecations
│   ├── parsers/                      # Pure Node/TS parsers — MUST NOT import 'vscode'
│   │   ├── index.ts                  # Dispatcher: parseAnyOrcaFile() and re-exports
│   │   ├── types.ts                  # Shared ParsedOrcaData and domain interfaces
│   │   ├── orcaInputParser.ts        # .inp parser, block nesting, diagnostics, coordLineToAtomIndex map
│   │   ├── orcaOutputParser.ts       # Single-pass .out parser (opt, SCF, MOs, charges, freqs, TD-DFT, thermo)
│   │   ├── xyzParser.ts              # Single- and multi-frame .xyz / _trj.xyz parser
│   │   └── hessEngradParser.ts       # .hess (normal modes/IR) and .engrad (gradients) parsers (Bohr → Å)
│   ├── providers/
│   │   ├── completionProvider.ts     # Context-aware completions (!, %, *, solvents, inside %block)
│   │   ├── hoverProvider.ts          # Keyword/block/param hover + 0-based atom hover on coord lines
│   │   ├── diagnosticsProvider.ts    # Maps orcaInputParser diagnostics to VS Code DiagnosticCollection
│   │   └── symbolProvider.ts         # DocumentSymbolProvider backed by ParsedOrcaData.outline
│   ├── views/
│   │   └── sidebarViews.ts           # TreeDataProviders: Outline/TOC, Job Summary, Workspace Files
│   └── webview/
│       └── viewerPanel.ts            # Webview panel lifecycle, strict CSP HTML, host↔webview messaging
├── media/
│   ├── viewer.js                     # Browser-side 3Dmol.js + Chart.js controller (plain IIFE JS)
│   ├── viewer.css                    # VS Code theme-aware webview styles
│   ├── icon.png                      # 128×128 Marketplace icon
│   ├── orca-icon.svg                 # Activity Bar monochrome icon
│   └── vendor/                       # Build-copied 3Dmol-min.js & chart.umd.min.js (generated)
├── syntaxes/
│   ├── orca-input.tmLanguage.json    # TextMate grammar for .inp
│   └── orca-output.tmLanguage.json   # TextMate grammar for .out/.orcaout
├── snippets/
│   └── orca.json                     # ORCA 6 input snippets
└── test-fixtures/                    # Sample files used by scripts/run-tests.mjs
```

---

## Architecture & Domain Invariants

Follow these invariants strictly when making changes:

1. **Zero `vscode` Dependency in `src/parsers/` and `src/data/`**
   - `scripts/run-tests.mjs` bundles `src/parsers/index.ts` and runs it directly in Node.js without the VS Code extension host.
   - Never import `vscode` inside `src/parsers/*` or `src/data/*`.

2. **Offline-First & Remote-SSH Compatibility**
   - Never load scripts, stylesheets, fonts, or data from external CDNs or remote URLs in either the extension host or the Webview.
   - Browser dependencies (`3dmol`, `chart.js`) are declared in `devDependencies` and copied into `media/vendor/` by `scripts/build.mjs`.
   - Keep `dependencies` in `package.json` empty; `esbuild` bundles everything except `external: ['vscode']`.

3. **Webview Security (CSP & HTML Escaping)**
   - `src/webview/viewerPanel.ts` enforces `default-src 'none'`; `script-src ${webview.cspSource}` (no `'unsafe-inline'` scripts, no `eval`).
   - All client logic belongs in `media/viewer.js`, not inline `<script>` tags or `onclick="..."` handlers.
   - Always sanitize file-derived strings through `escapeHtml()` before assigning to `innerHTML`.

4. **Quantum Chemistry Conventions & Units**
   - **Atom indexing**: `Atom.index` is **0-based** (matching ORCA `%geom Constraints / Scan` and output tables). Display 1-based indices only as supplementary labels.
   - **Length units**: All `Atom.{x,y,z}` coordinates stored in `ParsedOrcaData` MUST be in **Ångström**. `.hess` and `.engrad` coordinates are in Bohr and must be converted using `BOHR_TO_ANGSTROM = 0.529177210903`.
   - **Ghost atoms & ECPs**:
     - Ghost atoms (`Element :` in `.inp`/`.xyz`, or `ZA = 0` and `MASS = 0` in `.out` `CARTESIAN COORDINATES (A.U.)`) have `isGhost: true`.
     - Exclude ghost atoms from nuclear charge (`Z`) totals during electron/spin-parity validation and from the base molecular formula (report them separately via `nGhostAtoms`).
     - ECP atoms are flagged (`hasEcp: true`) when `ZA` has a trailing `*` in `CARTESIAN COORDINATES (A.U.)`.
   - **Energy & spectroscopy**: Raw energies are stored in Hartree (`Eh`); UI converts to `kcal/mol` (`627.509474`) or `kJ/mol` (`2625.499638`). Frequencies are in `cm⁻¹` (negative = imaginary mode).

5. **Performance on Large ORCA Outputs**
   - Real `.out` files can easily reach several megabytes. Keep `parseOrcaOutput()` strictly single-pass (`O(lines)`) and avoid catastrophic backtracking regexes.
   - `src/extension.ts` caches parse results by `(uri, document.version)`; clear/invalidate the cache on document edit/save/close.
   - Short-contact checking in `orcaInputParser.ts` is `O(N²)` and is intentionally capped at `<= 400` atoms and at most 10 warnings.

6. **`.out` / `.log` Language Auto-Detection**
   - Do **not** bind `.out` or `.log` directly in `package.json` `contributes.languages` — that would hijack unrelated build/Slurm logs.
   - Instead, `onStartupFinished` activates the extension so `inspectActiveDocument()` can peek at the first ~120 lines via `isOrcaOutputContent()` and call `vscode.languages.setTextDocumentLanguage(doc, 'orca-output')` only for genuine ORCA outputs.

7. **Keyword & Grammar Consistency**
   - When adding or updating ORCA 6 keywords, methods, blocks, or deprecated warnings, keep these files in sync:
     - `src/data/orca6Keywords.ts` (completions, hover, deprecation diagnostics)
     - `syntaxes/orca-input.tmLanguage.json` (syntax highlighting)
     - `snippets/orca.json` and `TEMPLATES` in `src/extension.ts` (if adding templates)

---

## Code Style & Conventions

- **TypeScript (`src/`)**: Strict mode (`"strict": true`, ES2022, CommonJS bundle). Prefer explicit return types on exported functions, small pure helpers, and graceful degradation (never throw unhandled exceptions when parsing malformed or partial/still-running ORCA files).
- **Webview (`media/viewer.js`, `media/viewer.css`)**: Vanilla ES2020+ IIFE with no bundler required. Use VS Code CSS theme variables (`--vscode-*`) with sensible dark-theme fallbacks.
- **VS Code Contributions (`package.json`)**:
  - Prefix all commands, views, context keys, and configuration settings with `orcaHelper.`.
  - Keep `@types/vscode` major.minor `<=` `engines.vscode` (enforced by `@vscode/vsce`).

---

## Testing & Fixture Hygiene

- Tests live in `scripts/run-tests.mjs` and execute via `npm test`.
- Any change to parsers, diagnostics, coordinate conversion, or output extraction MUST include corresponding assertions in `scripts/run-tests.mjs`.
- **Privacy & Repository Hygiene**:
  - **Never** commit unpublished research molecules, real user/cluster file paths, hostnames, job IDs, or oversized raw outputs into `test-fixtures/`.
  - Prefer minimal, self-contained synthetic fixtures or standard public molecules (e.g., `H2`, `H2O`, pyridine) that exercise the parser edge cases cleanly.

---

## Build Artifacts, Packaging & Release

- **Do not commit generated artifacts**: `node_modules/`, `dist/`, `media/vendor/`, `*.vsix`, and `dist/parsers-test-bundle.cjs` are generated and ignored via `.gitignore`.
- **`.vscodeignore` rules**:
  - Exclude development/meta files (`src/**`, `scripts/**`, `test-fixtures/**`, `AGENTS.md`, `.github/**`, `tsconfig.json`, `*.vsix`, `**/*.map`).
  - Keep runtime & Marketplace files (`dist/extension.js`, `media/**`, `syntaxes/**`, `snippets/**`, `language-configuration.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`).
- **Release checklist**:
  1. Run `npm run typecheck && npm test && npm run compile`.
  2. Bump `version` in `package.json` and document changes in `CHANGELOG.md`.
  3. Verify package contents with `./node_modules/.bin/vsce ls`.
  4. Package (`npm run package`) or publish (`npx @vscode/vsce publish`).
