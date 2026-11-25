# Changelog

All notable changes to **ORCA 6 Helper** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-25

### Added
- **ORCA 6 Input Language Intelligence (`.inp`)**:
  - TextMate syntax highlighting for `!` simple input lines, `%block ... end`, nested sub-blocks, `* xyz` / `* xyzfile` blocks, ghost atoms (`Element :`), and `$new_job`.
  - Context-aware autocomplete for ORCA 6 methods, 3c composite methods, basis sets, run types (`GOAT`, `NEB-TS`, `DEFGRID3`), solvents (`CPCM`/`SMD`/`ALPB`), `%block` templates, and block parameters.
  - Hover documentation for keywords, blocks, parameters, and 0-based ORCA atom indices on coordinate lines.
  - Real-time diagnostics for unclosed blocks/coordinates, unknown elements, missing `* xyzfile`, electron/spin-multiplicity parity mismatch (excluding ghost atoms), overlapping short contacts, and deprecated ORCA 4 keywords.
  - Built-in calculation snippets and `ORCA 6: Insert Calculation Template` command.
- **Output Parsing & Sidebar Navigation (`.inp`, `.out`, `.xyz`, `.hess`, `.engrad`)**:
  - Auto-detection of ORCA `.out` / `.log` files for syntax highlighting and outline navigation.
  - Activity Bar views: **ORCA Outline / TOC**, **Job Summary**, and **ORCA Workspace Files**.
  - Quick switching between sibling files (`.inp`, `.out`, `_trj.xyz`, `.xyz`, `.hess`, `.engrad`, `.property.txt`) and copying final geometry as `* xyz` block.
- **Offline Interactive 3D & Analysis Viewer**:
  - Embedded `3Dmol.js` molecular viewer with multiple representations, Mulliken/Loewdin/Hirshfeld charge coloring, translucent BSSE ghost atoms, dipole/gradient vector arrows, click-to-measure distances/angles/dihedrals, trajectory playback, XYZ export, and PNG screenshot capture.
  - Embedded `Chart.js` analysis tabs: interactive optimization energy & gradient/step convergence plots, SCF convergence, vibrational frequency table with live 3D normal-mode animation, Lorentzian-broadened IR spectra, and Gaussian-broadened TD-DFT UV-Vis spectra.
