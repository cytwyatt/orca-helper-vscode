# Changelog

All notable changes to **ORCA 6 Helper** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-25

### Added
- **Smart `.inp` Language Auto-Detection (`orcaHelper.autoDetectInputLanguage`)**: Automatically detects ORCA syntax (`!`, `%block`, `* xyz`, `$new_job`) and switches `.inp` buffers to `orca-input` even when another extension (such as Packmol in `gmx_helper`) claims `.inp` by default, while ignoring Packmol/Abaqus `.inp` files so they never receive false ORCA diagnostics.
- **Native `.trj` and `.allxyz` Support**: Added full syntax/viewer/sidebar support for `.trj` trajectories and ORCA relaxed-scan `.allxyz` files (including `>` frame separators and standalone energy comments).
- **In-Viewer Sibling Trajectory & Vibration Switcher**: Automatically detects sibling `_trj.xyz`, `.allxyz`, `_MEP_trj.xyz`, `_IRC_Full_trj.xyz`, `.trj`, `.hess`, `.out`, `.inp`, and `.engrad` files and renders one-click switch pills at the top of the 3D Viewer.
- **Auto-Enrichment from Sibling `.hess`**: When opening a `.out` file whose frequencies lack printed `NORMAL MODES` vectors, automatically merges normal-mode displacements and IR intensities from the matching sibling `.hess` file.
- **Upgraded Vibration & Trajectory Controls**:
  - Dedicated `〰 Vibrations` quick button on the 3D toolbar, `◀` / `▶` mode steppers, and **Export Mode XYZ** (20-frame sinusoidal animation export).
  - Auto-selects the `Frequencies & IR` tab for `.hess` files and `Convergence & Energy` tab for multi-frame trajectories.
  - Keyboard shortcuts in the 3D Viewer: `Space` (play/pause trajectory or stop vibration), `←`/`→` (previous/next frame), `↑`/`↓` (previous/next vibrational mode).

### Fixed
- Fixed responsive CSS layout on narrow/split panels so the trajectory playback bar (`#traj-bar`) and vibration bar (`#vib-bar`) are never clipped.
- Fixed clicking `▶ Play` on the final optimization frame so playback cleanly restarts from frame 1.
- Eliminated unnecessary DOM table re-renders during 30 fps normal-mode vibrational animations.

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
