# ORCA 6 Helper for VS Code

**English** | [简体中文](./README.zh-CN.md)

An all-in-one, **offline-first** VS Code extension built specifically for **ORCA 6** (6.0 / 6.1) quantum chemistry workflows. It combines rich `.inp` language intelligence, fast output outline navigation, an interactive 3D molecular & trajectory viewer (`3Dmol.js`), convergence plots, live normal-mode vibrational animations, and simulated IR / UV-Vis spectra (`Chart.js`) — with zero external CDN dependencies and full **Remote-SSH** compatibility.

---

## Features

### 1. ORCA 6 Input (`.inp`) Language Intelligence
- **Syntax Highlighting**: Distinguishes `!` simple-input keywords (functionals, 3c composite methods, basis sets, dispersion, run types, solvation models), `%block ... end`, nested sub-blocks, `* xyz` / `* xyzfile` blocks, ghost atoms (`Element :`), and `$new_job`.
- **Context-Aware Autocomplete**:
  - `!` lines: ORCA 6 methods, basis sets, grids (`DEFGRID1/2/3`), run types (`GOAT`, `NEB-TS`, `OptTS`, `ESD`, `VPT2`, etc.), and solvent suggestions inside `CPCM(...)` / `SMD(...)` / `ALPB(...)`.
  - `%` lines: Inserts structured `%block` templates (`%scf`, `%geom`, `%basis`, `%tddft`, `%freq`, `%cpcm`, `%neb`, `%goat`, `%mdci`, `%casscf`, `%rel`, etc.) and offers block-specific parameters with types and defaults.
  - `*` lines: Completes `* xyz`, `* xyzfile`, `* int`, and `* gzmt` blocks.
- **Rich Hover Documentation**:
  - Hover over keywords, `%block` headers, or parameters for ORCA 6 documentation.
  - **Hover over any coordinate line to inspect its 0-based ORCA atom index** (ready for `%geom Constraints / Scan`), 1-based index, atomic number, atomic mass, coordinates, and ghost-atom status.
- **Real-Time Diagnostics**:
  - Catches unclosed `%block` / sub-blocks, stray `end`, unclosed `* xyz`, malformed coordinate lines, unknown elements, and missing `* xyzfile` paths.
  - Validates **electron count vs. charge / spin multiplicity parity** (automatically excluding ghost atoms).
  - Flags overlapping / short atomic contacts (configurable threshold, default `< 0.5 Å`).
  - Warns about deprecated ORCA 4 keywords (e.g., `Grid4` / `Grid5` / `FinalGrid6` → `DEFGRID2` / `DEFGRID3`).
- **Snippets & Templates**: Built-in snippets (`orca-opt-freq`, `orca-sp`, `orca-tddft`, `orca-optts`, `orca-goat`, `orca-scan`, `orca-neb`, `orca-basis-ecp`) plus the `ORCA 6: Insert Calculation Template` command.

### 2. Output Parsing, Sidebar Navigation & Offline 3D / Chart Analysis
Supports `.inp`, `.out` / `.orcaout` / `.log` (auto-detected via ORCA header), `.xyz` / `*_trj.xyz`, `.hess`, and `.engrad`:

- **Activity Bar Views (`ORCA 6 Helper`)**:
  - **ORCA Outline / TOC**: Jump directly to optimization cycles, energies, orbitals, atomic charges, dipole moments, frequencies, spectra, thermochemistry, and error lines.
  - **Job Summary**: At-a-glance status, ORCA version, molecular formula, charge/multiplicity, final energy, optimization convergence, imaginary frequency count, HOMO–LUMO gap, dipole moment, Gibbs free energy, and total runtime.
  - **ORCA Workspace Files**: Browse ORCA files across your workspace (ignoring `node_modules`, `.git`, and Slurm log directories).
- **Interactive 3D Molecular & Trajectory Viewer (`3Dmol.js`)**:
  - Switch between **Ball & Stick**, **Stick**, **CPK Sphere**, and **Wireframe**, with coloring by element or **Mulliken / Loewdin / Hirshfeld** partial charges.
  - Detects **BSSE ghost atoms** (rendered as translucent cyan markers with a one-click toggle) and **ECP atoms**.
  - **Click-to-measure** bond distances (2 atoms), angles (3 atoms), and dihedrals (4 atoms).
  - **Trajectory & Scan Playback**: Frame slider, variable speed (`0.5x`–`4x`), loop toggle, relative energy (`ΔE`), jump-to-line in the text editor, copy current frame as an ORCA `* xyz` block, export `.xyz`, or save a PNG screenshot.
  - Overlay **dipole moment** and `.engrad` **nuclear gradient** vectors.
- **Convergence Plots, Vibrational Animations & Spectra (`Chart.js`)**:
  - Optimization energy curve (`ΔE` in `kcal/mol`, `kJ/mol`, or absolute `Eh` — **click any point to jump the 3D viewer to that cycle**), gradient/step log-scale convergence plot, and latest SCF convergence plot.
  - Vibrational frequency table (highlighting imaginary modes) with **one-click 3D normal-mode animation** (adjustable amplitude, speed, and displacement vectors).
  - Interactive Lorentzian-broadened **IR spectrum** and Gaussian-broadened **TD-DFT UV-Vis spectrum**.

---

## Supported File Formats

| Extension | Capabilities |
| :--- | :--- |
| `.inp` | Syntax highlighting, completions, hover (0-based atom index), snippets, real-time diagnostics, outline, 3D geometry preview |
| `.out`, `.orcaout`, `.log` | Auto-detected ORCA output highlighting, TOC outline, job summary, 3D trajectory, convergence plots, MOs, charges, frequencies/animations, IR, UV-Vis, thermochemistry |
| `.xyz`, `*_trj.xyz`, `.trj`, `.allxyz` | Single- and multi-frame 3D trajectory playback (including ORCA scan `.allxyz`, NEB/IRC trajectories), energy curve, keyboard controls (`Space`, `←`/`→`) |
| `.hess` | Geometry (auto-converted Bohr → Å), vibrational frequencies, 3D normal-mode animations (`◀`/`▶` mode stepper, vector arrows, 20-frame XYZ export), simulated IR spectrum |
| `.engrad` | Geometry (auto-converted Bohr → Å), total energy, 3D nuclear gradient vector arrows |

---

## Quick Start

1. Open any `.inp`, `.out`, `.xyz`, `.hess`, or `.engrad` file in VS Code.
2. Click the **Preview** icon in the editor title bar (or click **`ORCA 6: ...`** in the bottom-right status bar) to launch the **3D Structure & Analysis Viewer**.
3. Click the **Switch Related File** icon in the editor title bar (`ORCA 6: Switch Between Related Files`) to jump between matching `.inp` / `.out` / `_trj.xyz` / `.xyz` / `.hess` / `.engrad` files.
4. Run **`ORCA 6: Insert Calculation Template`** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) to scaffold a new ORCA 6 input file.

---

## Extension Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `orcaHelper.autoDetectInputLanguage` | `true` | Automatically switch `.inp` files containing ORCA syntax to ORCA Input (coexists cleanly with Packmol / other `.inp` extensions). |
| `orcaHelper.autoDetectOutputLanguage` | `true` | Automatically apply ORCA Output highlighting to `.out`/`.log` files containing an ORCA header. |
| `orcaHelper.defaultRepresentation` | `"ballstick"` | Default 3D representation (`ballstick`, `stick`, `sphere`, `line`). |
| `orcaHelper.showGhostAtoms` | `true` | Show BSSE ghost atoms as translucent markers by default. |
| `orcaHelper.shortContactThreshold` | `0.5` | Interatomic distance threshold (Å) below which `.inp` diagnostics warn of overlapping atoms. |
| `orcaHelper.irBroadeningFwhm` | `20` | Default Lorentzian FWHM broadening (cm⁻¹) for simulated IR spectra. |
| `orcaHelper.uvBroadeningEv` | `0.3` | Default Gaussian broadening (eV) for simulated TD-DFT UV-Vis spectra. |

---

## Installation

### From VS Code Marketplace
Search for **`ORCA 6 Helper`** (`cytwyatt.orca-helper-vscode`) in the VS Code Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`), visit the [VS Code Marketplace page](https://marketplace.visualstudio.com/items?itemName=cytwyatt.orca-helper-vscode), or install via CLI:
```bash
code --install-extension cytwyatt.orca-helper-vscode
```

### From a Local `.vsix` File
```bash
code --install-extension orca-helper-vscode-0.1.0.vsix
```
Or open the Extensions view → `...` menu → **Install from VSIX...**.

---

## Development

```bash
npm install
npm run typecheck
npm test
npm run compile
npm run package
```

See [AGENTS.md](./AGENTS.md) for architecture notes and contribution guidelines.

## License

[MIT](./LICENSE)
