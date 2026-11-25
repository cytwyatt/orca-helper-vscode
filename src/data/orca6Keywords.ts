export interface KeywordDoc {
  name: string;
  category:
    | 'Method'
    | 'Composite'
    | 'Dispersion'
    | 'Basis'
    | 'AuxBasis'
    | 'RunType'
    | 'SCF'
    | 'Grid'
    | 'Approximation'
    | 'Solvation'
    | 'Relativistic'
    | 'Property'
    | 'Output'
    | 'PNO';
  summary: string;
  details?: string;
  orca6Note?: string;
  snippet?: string;
}

export interface BlockParamDoc {
  name: string;
  type: string;
  defaultVal?: string;
  summary: string;
  snippet?: string;
}

export interface BlockDoc {
  name: string; // without leading %
  summary: string;
  singleLine?: boolean;
  snippet: string;
  params: BlockParamDoc[];
}

export const ORCA6_SIMPLE_KEYWORDS: KeywordDoc[] = [
  // Run types
  { name: 'SP', category: 'RunType', summary: 'Single point energy calculation (default if no RunType is given).' },
  { name: 'EnGrad', category: 'RunType', summary: 'Single point energy + analytical/numerical nuclear gradient.' },
  { name: 'Opt', category: 'RunType', summary: 'Geometry optimization in redundant internal coordinates (default tolerances).' },
  { name: 'LooseOpt', category: 'RunType', summary: 'Geometry optimization with loose convergence thresholds (pre-optimization).' },
  { name: 'NormalOpt', category: 'RunType', summary: 'Standard geometry optimization thresholds.' },
  { name: 'TightOpt', category: 'RunType', summary: 'Tight geometry optimization (ΔE < 1e-6 Eh, RMS Grad < 3e-5, Max Grad < 1e-4 Eh/bohr).' },
  { name: 'VeryTightOpt', category: 'RunType', summary: 'Very tight geometry optimization (ΔE < 2e-7 Eh, RMS Grad < 8e-6, Max Grad < 3e-5 Eh/bohr). Recommended for non-covalent complexes & frequencies.' },
  { name: 'OptTS', category: 'RunType', summary: 'Transition state (first-order saddle point) geometry optimization using eigenvector following.' },
  { name: 'COPT', category: 'RunType', summary: 'Geometry optimization in Cartesian coordinates.' },
  { name: 'Freq', category: 'RunType', summary: 'Harmonic vibrational frequency & thermochemistry calculation (analytical when available, else numerical).', orca6Note: 'In ORCA 6.1, analytical Raman intensities and solvated Hessians are supported.' },
  { name: 'AnFreq', category: 'RunType', summary: 'Force analytical Hessian / vibrational frequency calculation.' },
  { name: 'NumFreq', category: 'RunType', summary: 'Numerical Hessian / vibrational frequency calculation by finite differences (e.g. for MP2/CCSD).' },
  { name: 'NEB', category: 'RunType', summary: 'Nudged Elastic Band reaction path optimization.' },
  { name: 'NEB-TS', category: 'RunType', summary: 'Climbing-image NEB followed automatically by OptTS transition state refinement.' },
  { name: 'NEB-CI', category: 'RunType', summary: 'Climbing-image Nudged Elastic Band optimization.' },
  { name: 'ZOOM-NEB-TS', category: 'RunType', summary: 'Zooming NEB with automatic transition state refinement.' },
  { name: 'IRC', category: 'RunType', summary: 'Intrinsic Reaction Coordinate path following from a transition state.' },
  { name: 'GOAT', category: 'RunType', summary: 'Global Optimizer Algorithm for conformer search and global minimum exploration.', orca6Note: 'New flagship global optimization engine in ORCA 6.' },
  { name: 'GOAT-REACT', category: 'RunType', summary: 'GOAT mode for automated reaction discovery and bond rearrangement exploration.', orca6Note: 'New in ORCA 6.' },
  { name: 'GOAT-EXPLORE', category: 'RunType', summary: 'GOAT exploration mode sampling wider potential energy surface basins.', orca6Note: 'New in ORCA 6.' },
  { name: 'GOAT-ENTROPY', category: 'RunType', summary: 'GOAT ensemble conformational entropy estimation.', orca6Note: 'New in ORCA 6.' },
  { name: 'MD', category: 'RunType', summary: 'Ab initio molecular dynamics simulation (configure via %md).' },
  { name: 'DOCKER', category: 'RunType', summary: 'Automated guest-host docking algorithm in ORCA 6.' },
  { name: 'SOLVATOR', category: 'RunType', summary: 'Explicit microsolvation shell builder around a solute.', orca6Note: 'New in ORCA 6.' },
  { name: 'ESD', category: 'RunType', summary: 'Excited State Dynamics (vibronic absorption/fluorescence/phosphorescence/ISC/IC rates).' },
  { name: 'VPT2', category: 'RunType', summary: 'Second-order vibrational perturbation theory for anharmonic frequencies & IR.' },
  { name: 'NMR', category: 'RunType', summary: 'NMR chemical shielding tensor calculation (GIAO).' },

  // Composite 3c methods
  { name: 'r2SCAN-3c', category: 'Composite', summary: 'Fast, accurate composite mGGA DFT method (r2SCAN + D4 + gCP + mTZVPP). Excellent default for geometries & frequencies.' },
  { name: 'wB97X-3c', category: 'Composite', summary: 'Range-separated hybrid composite method (wB97X + D4 + vDZP). Very strong for reaction barriers & non-covalent interactions.', orca6Note: 'Built-in in ORCA 6.' },
  { name: 'B97-3c', category: 'Composite', summary: 'Low-cost GGA composite method (B97 + D3BJ + mTZVP) for fast geometries.' },
  { name: 'PBEh-3c', category: 'Composite', summary: 'Hybrid DFT composite method (PBEh + D3BJ + gCP + def2-mSVP).' },
  { name: 'HF-3c', category: 'Composite', summary: 'Minimal-basis Hartree-Fock composite method with D3BJ + gCP + SRB.' },

  // DFT functionals
  { name: 'B3LYP', category: 'Method', summary: 'Hybrid GGA functional (20% HF exchange). Pair with D3BJ or D4 for dispersion.' },
  { name: 'BHANDHLYP', category: 'Method', summary: 'Half-and-half hybrid GGA (50% HF exchange). Frequently used for halogen bonding & radical/charge-transfer benchmarks.' },
  { name: 'PBE0', category: 'Method', summary: 'Hybrid GGA functional (25% HF exchange). Pair with D3BJ or D4.' },
  { name: 'PBE', category: 'Method', summary: 'Pure GGA functional (Perdew-Burke-Ernzerhof). Fast with RI-J.' },
  { name: 'BP86', category: 'Method', summary: 'Pure GGA functional (Becke88 + Perdew86). Fast for transition-metal geometries.' },
  { name: 'BLYP', category: 'Method', summary: 'Pure GGA functional (Becke88 + LYP).' },
  { name: 'TPSS', category: 'Method', summary: 'Pure meta-GGA functional.' },
  { name: 'TPSSh', category: 'Method', summary: 'Hybrid meta-GGA functional (10% HF exchange), popular for transition metals.' },
  { name: 'r2SCAN', category: 'Method', summary: 'Regularized-restored SCAN meta-GGA functional with smooth numerical grids.' },
  { name: 'r2SCAN0', category: 'Method', summary: 'Hybrid meta-GGA r2SCAN with 25% HF exchange.' },
  { name: 'M062X', category: 'Method', summary: 'Minnesota hybrid meta-GGA (54% HF exchange). Recommend DEFGRID3.' },
  { name: 'M06L', category: 'Method', summary: 'Local Minnesota meta-GGA functional.' },
  { name: 'CAM-B3LYP', category: 'Method', summary: 'Range-separated hybrid functional, widely used for TD-DFT excited states.' },
  { name: 'wB97X-D3', category: 'Method', summary: 'Range-separated hybrid GGA with D3ZERO dispersion.' },
  { name: 'wB97X-D3BJ', category: 'Method', summary: 'Range-separated hybrid GGA with D3BJ dispersion.' },
  { name: 'wB97X-D4', category: 'Method', summary: 'Range-separated hybrid GGA with D4 dispersion.' },
  { name: 'wB97X-V', category: 'Method', summary: 'Range-separated hybrid GGA with VV10 nonlocal correlation (SCNL/NL).' },
  { name: 'wB97M-V', category: 'Method', summary: 'Top-performing range-separated hybrid meta-GGA with VV10 nonlocal dispersion.' },
  { name: 'wB97M-D4', category: 'Method', summary: 'Range-separated hybrid meta-GGA wB97M with D4 dispersion.' },
  { name: 'B2PLYP', category: 'Method', summary: 'Double-hybrid DFT (53% HF + 27% PT2). Needs AuxC basis (e.g. def2-TZVPP/C).' },
  { name: 'DSD-PBEP86', category: 'Method', summary: 'Spin-component-scaled double-hybrid functional with D3BJ/D4.' },
  { name: 'revDSD-PBEP86-D4', category: 'Method', summary: 'Revised spin-component-scaled double hybrid with D4 dispersion.' },

  // Wavefunction & Semiempirical
  { name: 'HF', category: 'Method', summary: 'Hartree-Fock method (automatically RHF for closed-shell, UHF for open-shell).' },
  { name: 'RHF', category: 'Method', summary: 'Spin-restricted Hartree-Fock.' },
  { name: 'UHF', category: 'Method', summary: 'Spin-unrestricted Hartree-Fock.' },
  { name: 'ROHF', category: 'Method', summary: 'Restricted open-shell Hartree-Fock.' },
  { name: 'RKS', category: 'Method', summary: 'Force spin-restricted Kohn-Sham DFT.' },
  { name: 'UKS', category: 'Method', summary: 'Force spin-unrestricted Kohn-Sham DFT.' },
  { name: 'MP2', category: 'Method', summary: 'Second-order Møller-Plesset perturbation theory.' },
  { name: 'RI-MP2', category: 'Method', summary: 'Resolution-of-the-Identity MP2 (requires /C auxiliary basis or AutoAux).' },
  { name: 'SCS-MP2', category: 'Method', summary: 'Spin-Component-Scaled MP2.' },
  { name: 'DLPNO-MP2', category: 'Method', summary: 'Domain-based Local Pair Natural Orbital MP2 (linear-scaling).' },
  { name: 'CCSD', category: 'Method', summary: 'Coupled Cluster Singles and Doubles.' },
  { name: 'CCSD(T)', category: 'Method', summary: 'Coupled Cluster Singles, Doubles, and perturbative Triples (gold standard).' },
  { name: 'DLPNO-CCSD(T)', category: 'Method', summary: 'Near-linear-scaling local CCSD(T) (pair with TightPNO for benchmark accuracy).' },
  { name: 'DLPNO-CCSD(T1)', category: 'Method', summary: 'DLPNO-CCSD(T) with iterative triples (T1) for highest local CC accuracy.' },
  { name: 'CASSCF', category: 'Method', summary: 'Complete Active Space SCF (configure nel/norb in %casscf).' },
  { name: 'NEVPT2', category: 'Method', summary: 'N-Electron Valence State Perturbation Theory (on top of CASSCF).' },
  { name: 'XTB2', category: 'Method', summary: 'GFN2-xTB semiempirical tight-binding method (very fast pre-opt / GOAT).' },
  { name: 'GFN2-XTB', category: 'Method', summary: 'GFN2-xTB semiempirical method (alias for XTB2).' },
  { name: 'NATIVE-GFN2-XTB', category: 'Method', summary: 'ORCA 6 native internal GFN2-xTB implementation (no external xtb binary needed).', orca6Note: 'New in ORCA 6.' },
  { name: 'GFN-FF', category: 'Method', summary: 'Grimme general force field for ultra-fast conformational sampling.' },

  // Dispersion
  { name: 'D3BJ', category: 'Dispersion', summary: 'Grimme DFT-D3 dispersion correction with Becke-Johnson damping.' },
  { name: 'D3ZERO', category: 'Dispersion', summary: 'Grimme DFT-D3 dispersion correction with zero damping.' },
  { name: 'D4', category: 'Dispersion', summary: 'Grimme DFT-D4 charge-dependent atomic dispersion correction.' },
  { name: 'NL', category: 'Dispersion', summary: 'VV10 nonlocal van der Waals correlation (post-SCF).' },
  { name: 'SCNL', category: 'Dispersion', summary: 'Self-consistent VV10 nonlocal van der Waals correlation.' },

  // Basis sets
  { name: 'def2-SVP', category: 'Basis', summary: 'Karlsruhe polarized double-zeta valence basis set (fast screening/opt).' },
  { name: 'def2-TZVP', category: 'Basis', summary: 'Karlsruhe polarized triple-zeta valence basis set (good production standard).' },
  { name: 'def2-TZVPP', category: 'Basis', summary: 'Karlsruhe doubly polarized triple-zeta basis set (great for DFT opt & freq).' },
  { name: 'def2-TZVPD', category: 'Basis', summary: 'Diffuse-augmented def2-TZVP (recommended for anions, excited states, NCI).' },
  { name: 'def2-TZVPPD', category: 'Basis', summary: 'Diffuse-augmented def2-TZVPP (high accuracy for NCI & properties).' },
  { name: 'def2-QZVP', category: 'Basis', summary: 'Karlsruhe polarized quadruple-zeta basis set (near CBS limit).' },
  { name: 'def2-QZVPP', category: 'Basis', summary: 'Karlsruhe doubly polarized quadruple-zeta basis set (benchmark SP).' },
  { name: 'def2-QZVPPD', category: 'Basis', summary: 'Diffuse-augmented quadruple-zeta basis set.' },
  { name: 'ma-def2-TZVP', category: 'Basis', summary: 'Minimally augmented diffuse def2-TZVP (efficient alternative to def2-TZVPD).' },
  { name: 'ma-def2-QZVPP', category: 'Basis', summary: 'Minimally augmented diffuse def2-QZVPP.' },
  { name: 'cc-pVDZ', category: 'Basis', summary: 'Dunning correlation-consistent double-zeta basis set.' },
  { name: 'cc-pVTZ', category: 'Basis', summary: 'Dunning correlation-consistent triple-zeta basis set.' },
  { name: 'cc-pVQZ', category: 'Basis', summary: 'Dunning correlation-consistent quadruple-zeta basis set.' },
  { name: 'aug-cc-pVDZ', category: 'Basis', summary: 'Augmented Dunning double-zeta basis set (diffuse functions).' },
  { name: 'aug-cc-pVTZ', category: 'Basis', summary: 'Augmented Dunning triple-zeta basis set (for MP2/CCSD/NCI).' },
  { name: 'aug-cc-pVQZ', category: 'Basis', summary: 'Augmented Dunning quadruple-zeta basis set.' },
  { name: 'def2/J', category: 'AuxBasis', summary: 'Universal Coulomb fitting auxiliary basis set for def2 basis sets (default in ORCA 6 with RIJCOSX).' },
  { name: 'def2-TZVPP/C', category: 'AuxBasis', summary: 'Correlation fitting auxiliary basis for RI-MP2 / DLPNO / double hybrids.' },
  { name: 'def2-QZVPP/C', category: 'AuxBasis', summary: 'Quadruple-zeta correlation fitting auxiliary basis.' },
  { name: 'AutoAux', category: 'AuxBasis', summary: 'Automatically generate general-purpose auxiliary basis sets for all elements.' },

  // Grids & SCF & Approximations
  { name: 'DEFGRID1', category: 'Grid', summary: 'Coarse DFT integration grid (fast screening only).', orca6Note: 'ORCA 5/6 replacement for Grid2/3.' },
  { name: 'DEFGRID2', category: 'Grid', summary: 'Default DFT integration grid in ORCA 6 (balanced accuracy & speed).', orca6Note: 'Default in ORCA 6.' },
  { name: 'DEFGRID3', category: 'Grid', summary: 'Fine DFT integration grid (recommended for meta-GGAs, frequencies, NCI, VeryTightOpt).', orca6Note: 'Recommended for Minnesota functionals & NCI scans.' },
  { name: 'TightSCF', category: 'SCF', summary: 'Tight SCF convergence (ΔE < 1e-8 Eh). Default for Opt/Freq in ORCA 6.' },
  { name: 'VeryTightSCF', category: 'SCF', summary: 'Very tight SCF convergence (ΔE < 1e-9 Eh). Recommended for VeryTightOpt, NumFreq & NCI.' },
  { name: 'ExtremeSCF', category: 'SCF', summary: 'Extreme SCF convergence (ΔE < 1e-14 Eh).' },
  { name: 'SlowConv', category: 'SCF', summary: 'Conservative SCF damping/level-shifting for difficult transition metal or open-shell systems.' },
  { name: 'TRAH', category: 'SCF', summary: 'Trust-Region Augmented Hessian second-order SCF solver (auto-enabled in ORCA 6 when DIIS struggles).' },
  { name: 'SOSCF', category: 'SCF', summary: 'Second-order SCF orbital rotation solver.' },
  { name: 'KDIIS', category: 'SCF', summary: 'Kollmar DIIS SCF convergence accelerator.' },
  { name: 'RIJCOSX', category: 'Approximation', summary: 'RI for Coulomb (J) + Chain-of-Spheres for HF Exchange (COSX). Default for hybrid DFT in ORCA 6.' },
  { name: 'NORI', category: 'Approximation', summary: 'Disable RI / RIJCOSX approximations (exact 4-center ERIs).' },
  { name: 'NoFrozenCore', category: 'Approximation', summary: 'Correlate all electrons in post-HF (MP2/CCSD) calculations.' },
  { name: 'TightPNO', category: 'PNO', summary: 'Tight PNO thresholds for DLPNO-CCSD(T) / DLPNO-MP2 (recommended for NCI & high accuracy).' },
  { name: 'NormalPNO', category: 'PNO', summary: 'Default PNO thresholds for DLPNO methods.' },
  { name: 'LoosePNO', category: 'PNO', summary: 'Loose PNO thresholds for fast DLPNO screening.' },
  { name: 'MOREAD', category: 'SCF', summary: 'Read initial orbitals from a previous .gbw file specified via %moinp.' },
  { name: 'NoAutoStart', category: 'SCF', summary: 'Prevent ORCA from automatically reading an existing <job>.gbw file.' },
  { name: 'KeepDens', category: 'Output', summary: 'Keep electron density file (.densities) after calculation finishes.' },

  // Solvation
  { name: 'CPCM(Water)', category: 'Solvation', summary: 'Conductor-like Polarizable Continuum Model implicit solvation.', snippet: 'CPCM(${1|Water,Acetonitrile,THF,DMSO,DMF,Methanol,Ethanol,Chloroform,DCM,Toluene,Hexane,Acetone,Benzene|})' },
  { name: 'SMD(Water)', category: 'Solvation', summary: 'Truhlar SMD continuum solvation model (includes cavitation/dispersion/solvation structure).', snippet: 'SMD(${1|Water,Acetonitrile,THF,DMSO,DMF,Methanol,Ethanol,Chloroform,DCM,Toluene,Hexane,Acetone,Benzene|})' },
  { name: 'ALPB(Water)', category: 'Solvation', summary: 'Analytical Linearized Poisson-Boltzmann solvation for xTB methods.', snippet: 'ALPB(${1|Water,Acetonitrile,THF,DMSO,DMF,Methanol,Chloroform,DCM,Toluene,Hexane|})' },

  // Relativistic
  { name: 'ZORA', category: 'Relativistic', summary: 'Zeroth-Order Regular Approximation scalar relativistic Hamiltonian.' },
  { name: 'DKH2', category: 'Relativistic', summary: '2nd-order Douglas-Kroll-Hess scalar relativistic Hamiltonian.' },
  { name: 'X2C', category: 'Relativistic', summary: 'Exact two-component scalar relativistic Hamiltonian.' },

  // Properties & Print
  { name: 'Hirshfeld', category: 'Property', summary: 'Compute Hirshfeld atomic charges and spin populations.' },
  { name: 'CHELPG', category: 'Property', summary: 'Compute electrostatic potential (ESP)-derived CHELPG atomic charges.' },
  { name: 'MBIS', category: 'Property', summary: 'Minimal Basis Iterative Stockholder atomic charges (well-suited for force-field parameterization).' },
  { name: 'NPA', category: 'Property', summary: 'Natural Population Analysis.' },
  { name: 'UNO', category: 'Property', summary: 'Compute Unrestricted Natural Orbitals (for open-shell UHF/UKS).' },
  { name: 'PrintBasis', category: 'Output', summary: 'Print full orbital basis set specification in output.' },
  { name: 'PrintMOs', category: 'Output', summary: 'Print molecular orbital coefficients in output.' },
  { name: 'LargePrint', category: 'Output', summary: 'Verbose output printing (includes MOs and basis details).' },
  { name: 'MiniPrint', category: 'Output', summary: 'Minimal output printing.' },
  { name: 'UseSym', category: 'Output', summary: 'Detect and use point-group symmetry.' },
  { name: 'NoUseSym', category: 'Output', summary: 'Disable point-group symmetry detection.' }
];

export const ORCA6_SOLVENTS: string[] = [
  'Water', 'Acetonitrile', 'Acetone', 'Ammonia', 'Benzene', 'CCl4', 'CH2Cl2',
  'Chloroform', 'Cyclohexane', 'DCM', 'DMF', 'DMSO', 'Ethanol', 'EthylAcetate',
  'Hexane', 'Methanol', 'Octanol', 'Pyridine', 'THF', 'Toluene', 'DiethylEther',
  'Heptane', 'Pentane', 'Propanol', 'Isopropanol', 'AceticAcid', 'Aniline'
];

export const ORCA6_DEPRECATED_KEYWORDS: Record<string, string> = {
  grid1: 'Removed in ORCA 5/6. Use DEFGRID1, DEFGRID2 (default), or DEFGRID3 instead.',
  grid2: 'Removed in ORCA 5/6. Use DEFGRID1, DEFGRID2 (default), or DEFGRID3 instead.',
  grid3: 'Removed in ORCA 5/6. Use DEFGRID1, DEFGRID2 (default), or DEFGRID3 instead.',
  grid4: 'Removed in ORCA 5/6. Use DEFGRID2 (default) or DEFGRID3 instead.',
  grid5: 'Removed in ORCA 5/6. Use DEFGRID2 or DEFGRID3 instead.',
  grid6: 'Removed in ORCA 5/6. Use DEFGRID3 instead.',
  grid7: 'Removed in ORCA 5/6. Use DEFGRID3 instead.',
  nofinalgrid: 'Removed in ORCA 5/6. ORCA 6 uses a single unified grid (DEFGRID1/2/3).',
  finalgrid5: 'Removed in ORCA 5/6. Use DEFGRID2 or DEFGRID3 instead.',
  finalgrid6: 'Removed in ORCA 5/6. Use DEFGRID3 instead.',
  finalgrid7: 'Removed in ORCA 5/6. Use DEFGRID3 instead.',
  gridx4: 'Removed in ORCA 5/6. COSX grid is controlled automatically by DEFGRID1/2/3.',
  gridx5: 'Removed in ORCA 5/6. COSX grid is controlled automatically by DEFGRID1/2/3.',
  gridx6: 'Removed in ORCA 5/6. COSX grid is controlled automatically by DEFGRID1/2/3.',
  'd3': 'In ORCA 6, specify D3BJ or D3ZERO explicitly (D3 defaults to D3BJ).'
};

export const ORCA6_BLOCKS: BlockDoc[] = [
  {
    name: 'pal',
    summary: 'Parallel execution settings (number of MPI processes).',
    snippet: '%pal nprocs ${1:16} end',
    params: [
      { name: 'nprocs', type: 'integer', defaultVal: '1', summary: 'Number of parallel MPI processes.' }
    ]
  },
  {
    name: 'maxcore',
    summary: 'Memory limit per MPI core in MB (single-line directive, no end required). Rule of thumb: set to ~75% of available RAM per core.',
    singleLine: true,
    snippet: '%maxcore ${1:4000}',
    params: []
  },
  {
    name: 'moinp',
    summary: 'Path to an existing .gbw file to read initial MOs from (pair with ! MOREAD). Single-line directive.',
    singleLine: true,
    snippet: '%moinp "${1:prev.gbw}"',
    params: []
  },
  {
    name: 'base',
    summary: 'Override the base filename for generated ORCA scratch/output files. Single-line directive.',
    singleLine: true,
    snippet: '%base "${1:jobname}"',
    params: []
  },
  {
    name: 'scf',
    summary: 'Self-Consistent Field convergence, solver, guess, and broken-symmetry settings.',
    snippet: '%scf\n  MaxIter ${1:300}\n  $0\nend',
    params: [
      { name: 'MaxIter', type: 'integer', defaultVal: '125', summary: 'Maximum number of SCF iterations.' },
      { name: 'Convergence', type: 'enum', defaultVal: 'Normal', summary: 'SCF convergence preset: Sloppy, Loose, Normal, Strong, Tight, VeryTight, Extreme.' },
      { name: 'ConvForced', type: 'boolean', defaultVal: 'false', summary: 'Abort calculation if SCF fails to converge.' },
      { name: 'DIISMaxEq', type: 'integer', defaultVal: '5', summary: 'Maximum number of Fock matrices stored in DIIS subspace.' },
      { name: 'AutoTRAH', type: 'boolean', defaultVal: 'true', summary: 'Automatically activate TRAH second-order solver if DIIS stalls (ORCA 6 default: true).' },
      { name: 'SOSCFStart', type: 'float', defaultVal: '0.0033', summary: 'Orbital gradient threshold to switch to SOSCF.' },
      { name: 'Shift', type: 'block', summary: 'Level shift: Shift Shift 0.1 ErrOff 0.1 end.' },
      { name: 'DampFac', type: 'float', defaultVal: '0.7', summary: 'Fock matrix damping factor.' },
      { name: 'BrokenSym', type: 'string', summary: 'Broken-symmetry DFT specification: BrokenSym M,N.' },
      { name: 'FlipSpin', type: 'string', summary: 'Flip spin on listed 0-based atom indices for broken-symmetry guess.' },
      { name: 'STABPerform', type: 'boolean', defaultVal: 'false', summary: 'Perform wavefunction stability analysis after SCF.' },
      { name: 'STABRestartUHFifUnstable', type: 'boolean', defaultVal: 'true', summary: 'Automatically restart UKS/UHF if instability is found.' },
      { name: 'TolE', type: 'float', summary: 'Custom SCF energy convergence tolerance (Eh).' }
    ]
  },
  {
    name: 'geom',
    summary: 'Geometry optimization, constraints, relaxed surface scans, Hessian handling, and TS search controls.',
    snippet: '%geom\n  MaxIter ${1:150}\n  $0\nend',
    params: [
      { name: 'MaxIter', type: 'integer', defaultVal: 'max(50, 3*N)', summary: 'Maximum geometry optimization cycles.' },
      { name: 'Calc_Hess', type: 'boolean', defaultVal: 'false', summary: 'Compute exact Hessian at step 0 (highly recommended for OptTS).' },
      { name: 'Recalc_Hess', type: 'integer', summary: 'Recalculate exact Hessian every N optimization steps.' },
      { name: 'InHess', type: 'enum', defaultVal: 'Almloef', summary: 'Initial Hessian guess: Read, Unit, Almloef, Lindh, Swart, XTB.' },
      { name: 'InHessName', type: 'string', summary: 'Path to .hess file when InHess Read is set.' },
      { name: 'Constraints', type: 'subblock', summary: 'Constrained optimization sub-block: { B 0 1 C } / { A 0 1 2 C } / { D 0 1 2 3 C } / { C 0 C }.', snippet: 'Constraints\n    { ${1|B,A,D,C|} ${2:0 1} C }\n  end' },
      { name: 'Scan', type: 'subblock', summary: 'Relaxed PES scan sub-block: B 0 1 = 1.5, 3.0, 16.', snippet: 'Scan\n    ${1|B,A,D|} ${2:0 1} = ${3:1.5}, ${4:3.0}, ${5:16}\n  end' },
      { name: 'Trust', type: 'float', defaultVal: '0.3', summary: 'Initial trust radius (bohr). Negative value fixes trust radius.' },
      { name: 'TS_Mode', type: 'subblock', summary: 'Select internal coordinate mode to follow in OptTS, e.g. { B 0 1 } end.' },
      { name: 'Hybrid_Hess', type: 'subblock', summary: 'Partial exact Hessian on selected 0-based atom indices: Hybrid_Hess [ 0 1 2 ] end.' },
      { name: 'TolE', type: 'float', summary: 'Energy change convergence tolerance (Eh).' },
      { name: 'TolRMSG', type: 'float', summary: 'RMS gradient convergence tolerance (Eh/bohr).' },
      { name: 'TolMaxG', type: 'float', summary: 'Max gradient convergence tolerance (Eh/bohr).' },
      { name: 'TolRMSD', type: 'float', summary: 'RMS displacement convergence tolerance (bohr).' },
      { name: 'TolMaxD', type: 'float', summary: 'Max displacement convergence tolerance (bohr).' },
      { name: 'Convergence', type: 'enum', summary: 'Preset: loose, normal, tight, verytight.' }
    ]
  },
  {
    name: 'basis',
    summary: 'Basis set, auxiliary basis, and ECP customization per element or globally.',
    snippet: '%basis\n  NewGTO ${1:I} "${2:aug-cc-pVDZ-PP}" end\n  NewECP ${1:I} "${3:SK-MCDHF-RSC}" end\nend',
    params: [
      { name: 'Basis', type: 'string', summary: 'Global orbital basis set name.' },
      { name: 'AuxJ', type: 'string', summary: 'Global Coulomb auxiliary basis set.' },
      { name: 'AuxC', type: 'string', summary: 'Global correlation auxiliary basis set.' },
      { name: 'AuxJK', type: 'string', summary: 'Global JK auxiliary basis set.' },
      { name: 'NewGTO', type: 'subblock', summary: 'Override orbital basis for an element: NewGTO I "aug-cc-pVDZ-PP" end.', snippet: 'NewGTO ${1:I} "${2:aug-cc-pVDZ-PP}" end' },
      { name: 'NewECP', type: 'subblock', summary: 'Override effective core potential for an element: NewECP I "SK-MCDHF-RSC" end.', snippet: 'NewECP ${1:I} "${2:SK-MCDHF-RSC}" end' },
      { name: 'NewAuxJGTO', type: 'subblock', summary: 'Override AuxJ basis for an element.' },
      { name: 'NewAuxCGTO', type: 'subblock', summary: 'Override AuxC basis for an element.' },
      { name: 'GTOName', type: 'string', summary: 'Read custom basis set definitions from an external file.' }
    ]
  },
  {
    name: 'tddft',
    summary: 'Time-Dependent DFT / Tamm-Dancoff (TDA) excited state calculations and spectra.',
    snippet: '%tddft\n  NRoots ${1:10}\n  TDA ${2|false,true|}\n  $0\nend',
    params: [
      { name: 'NRoots', type: 'integer', defaultVal: '5', summary: 'Number of excited states to compute.' },
      { name: 'Iroot', type: 'integer', defaultVal: '1', summary: 'Target excited state root for geometry optimization / gradient.' },
      { name: 'TDA', type: 'boolean', defaultVal: 'true', summary: 'Use Tamm-Dancoff Approximation (set false for full TD-DFT).' },
      { name: 'Triplets', type: 'boolean', defaultVal: 'false', summary: 'Also compute triplet excited states (for closed-shell reference).' },
      { name: 'DoNTO', type: 'boolean', defaultVal: 'false', summary: 'Generate Natural Transition Orbitals (NTOs).' },
      { name: 'SOC', type: 'boolean', defaultVal: 'false', summary: 'Compute spin-orbit coupling matrix elements between singlet and triplet roots.' },
      { name: 'MaxDim', type: 'integer', defaultVal: '5', summary: 'Davidson expansion space multiplier (MaxDim * NRoots).' },
      { name: 'ETol', type: 'float', defaultVal: '1e-6', summary: 'Energy convergence tolerance for excited states.' },
      { name: 'RTol', type: 'float', defaultVal: '1e-6', summary: 'Residual norm convergence tolerance.' },
      { name: 'FollowIRoot', type: 'boolean', defaultVal: 'false', summary: 'Track target excited state by overlap during Opt.' }
    ]
  },
  {
    name: 'freq',
    summary: 'Vibrational frequency, thermochemistry, and anharmonic settings.',
    snippet: '%freq\n  Temp ${1:298.15}\n  Pressure ${2:1.0}\nend',
    params: [
      { name: 'Temp', type: 'float', defaultVal: '298.15', summary: 'Temperature(s) in K for thermochemistry (multiple values allowed).' },
      { name: 'Pressure', type: 'float', defaultVal: '1.0', summary: 'Pressure in atm for thermochemistry.' },
      { name: 'Scale', type: 'float', defaultVal: '1.0', summary: 'Harmonic frequency scaling factor.' },
      { name: 'QuasiRRHO', type: 'boolean', defaultVal: 'true', summary: 'Use Grimme quasi-RRHO treatment for low-frequency vibrational entropy.' },
      { name: 'CutOffFreq', type: 'float', defaultVal: '100.0', summary: 'Cutoff frequency (cm^-1) for quasi-RRHO interpolation.' },
      { name: 'Anharm', type: 'boolean', defaultVal: 'false', summary: 'Enable VPT2 anharmonic frequency calculation.' },
      { name: 'NumFreq', type: 'boolean', defaultVal: 'false', summary: 'Force numerical differentiation.' }
    ]
  },
  {
    name: 'cpcm',
    summary: 'CPCM / SMD implicit solvation model parameters.',
    snippet: '%cpcm\n  smd ${1|true,false|}\n  SMDsolvent "${2:Water}"\nend',
    params: [
      { name: 'smd', type: 'boolean', defaultVal: 'false', summary: 'Enable SMD solvation model.' },
      { name: 'SMDsolvent', type: 'string', summary: 'Solvent name for SMD parameterization.' },
      { name: 'epsilon', type: 'float', summary: 'Custom static dielectric constant.' },
      { name: 'refrac', type: 'float', summary: 'Custom refractive index (n).' },
      { name: 'surfacetype', type: 'enum', defaultVal: 'gepol_ses', summary: 'Cavity surface type (gepol_ses, gepol_sas, vdw_gaussian).' }
    ]
  },
  {
    name: 'mp2',
    summary: 'MP2, RI-MP2, OO-MP2, and DLPNO-MP2 settings.',
    snippet: '%mp2\n  Density ${1|relaxed,unrelaxed|}\n  $0\nend',
    params: [
      { name: 'Density', type: 'enum', defaultVal: 'none', summary: 'MP2 density type: none, unrelaxed, relaxed (needed for properties/dipoles).' },
      { name: 'RI', type: 'boolean', defaultVal: 'false', summary: 'Enable RI approximation for MP2.' },
      { name: 'DoSCS', type: 'boolean', defaultVal: 'false', summary: 'Enable Spin-Component Scaling.' },
      { name: 'MaxCore', type: 'integer', summary: 'Override maxcore specifically for MP2 module.' }
    ]
  },
  {
    name: 'mdci',
    summary: 'Coupled cluster (CCSD, CCSD(T), DLPNO-CCSD(T)) and LED decomposition settings.',
    snippet: '%mdci\n  UseFullLMP2Guess ${1|true,false|}\n  $0\nend',
    params: [
      { name: 'DoLED', type: 'boolean', defaultVal: 'false', summary: 'Perform Local Energy Decomposition (LED) on DLPNO-CCSD(T) fragments.' },
      { name: 'TCutPNO', type: 'float', defaultVal: '3.33e-7', summary: 'PNO occupation cutoff (TightPNO uses 1e-7).' },
      { name: 'TCutPairs', type: 'float', defaultVal: '1e-4', summary: 'Strong/weak pair energy cutoff.' },
      { name: 'TCutMKN', type: 'float', defaultVal: '1e-3', summary: 'Mulliken population cutoff for domain construction.' },
      { name: 'MaxIter', type: 'integer', defaultVal: '50', summary: 'Maximum CC amplitude iterations.' }
    ]
  },
  {
    name: 'neb',
    summary: 'Nudged Elastic Band (NEB / NEB-TS / NEB-CI) transition state path search settings.',
    snippet: '%neb\n  NEB_End_XYZFile "${1:product.xyz}"\n  NImages ${2:8}\nend',
    params: [
      { name: 'NEB_End_XYZFile', type: 'string', summary: 'XYZ file of the product endpoint structure.' },
      { name: 'NEB_TS_XYZFile', type: 'string', summary: 'Optional initial TS guess XYZ file.' },
      { name: 'NImages', type: 'integer', defaultVal: '8', summary: 'Number of intermediate NEB images.' },
      { name: 'PreOpt_Ends', type: 'boolean', defaultVal: 'false', summary: 'Optimize reactant and product endpoints before NEB.' },
      { name: 'MaxIter', type: 'integer', defaultVal: '500', summary: 'Maximum NEB optimization iterations.' }
    ]
  },
  {
    name: 'goat',
    summary: 'ORCA 6 Global Optimizer Algorithm (GOAT) settings for conformer search & reactivity exploration.',
    snippet: '%goat\n  MaxOptIter ${1:500}\nend',
    params: [
      { name: 'MaxOptIter', type: 'integer', summary: 'Maximum geometry iterations per conformer.' },
      { name: 'GlobalIter', type: 'integer', summary: 'Number of global GOAT exploration iterations.' },
      { name: 'MaxEn', type: 'float', defaultVal: '6.0', summary: 'Energy window (kcal/mol) for keeping conformers.' },
      { name: 'FreeH', type: 'boolean', summary: 'Allow hydrogen rearrangements during GOAT.' },
      { name: 'Topol', type: 'boolean', defaultVal: 'true', summary: 'Enforce covalent bonding topology preservation.' }
    ]
  },
  {
    name: 'elprop',
    summary: 'Electric property calculations (dipole, quadrupole, polarizability, hyperpolarizability).',
    snippet: '%elprop\n  Polar ${1|1,0|}\n  Quadrupole ${2|true,false|}\nend',
    params: [
      { name: 'Dipole', type: 'boolean', defaultVal: 'true', summary: 'Calculate electric dipole moment.' },
      { name: 'Quadrupole', type: 'boolean', defaultVal: 'false', summary: 'Calculate electric quadrupole moment.' },
      { name: 'Polar', type: 'integer', defaultVal: '0', summary: 'Static polarizability (1 = analytical, 3 = numerical).' }
    ]
  },
  {
    name: 'plots',
    summary: 'Generate 3D cube/grid files for MOs, electron density, spin density, and ESP.',
    snippet: '%plots\n  Format Cube\n  MO("${1:homo.cube}", ${2:0}, 0);\nend',
    params: [
      { name: 'Format', type: 'enum', defaultVal: 'Gaussian_Cube', summary: 'Grid format: Cube, Gaussian_Cube, OpenDX, etc.' },
      { name: 'Dim1', type: 'integer', defaultVal: '40', summary: 'Grid points along x-axis.' },
      { name: 'Dim2', type: 'integer', defaultVal: '40', summary: 'Grid points along y-axis.' },
      { name: 'Dim3', type: 'integer', defaultVal: '40', summary: 'Grid points along z-axis.' },
      { name: 'ElDens', type: 'function', summary: 'Plot total electron density: ElDens("dens.cube");' },
      { name: 'SpinDens', type: 'function', summary: 'Plot spin density: SpinDens("spin.cube");' },
      { name: 'MO', type: 'function', summary: 'Plot MO: MO("mo.cube", orbitalIndex, operatorIndex);' }
    ]
  },
  {
    name: 'output',
    summary: 'Fine-grained control over printed sections in ORCA output.',
    snippet: '%output\n  Print[ P_Basis ] ${1:2}\n  Print[ P_MOs ] ${2:1}\nend',
    params: [
      { name: 'PrintLevel', type: 'enum', defaultVal: 'Normal', summary: 'Mini, Small, Normal, Large.' },
      { name: 'XYZFile', type: 'boolean', defaultVal: 'true', summary: 'Write final geometry to <job>.xyz.' }
    ]
  },
  {
    name: 'casscf',
    summary: 'Complete Active Space SCF / NEVPT2 settings.',
    snippet: '%casscf\n  nel ${1:6}\n  norb ${2:6}\n  mult ${3:1}\n  nroots ${4:1}\nend',
    params: [
      { name: 'nel', type: 'integer', summary: 'Number of active electrons.' },
      { name: 'norb', type: 'integer', summary: 'Number of active orbitals.' },
      { name: 'mult', type: 'integer', summary: 'Spin multiplicity (or comma-separated list for state-averaged).' },
      { name: 'nroots', type: 'integer', summary: 'Number of roots per multiplicity.' },
      { name: 'PTMethod', type: 'enum', summary: 'SC_NEVPT2, FIC_NEVPT2, FIC_CASPT2, etc.' }
    ]
  },
  {
    name: 'rel',
    summary: 'Relativistic Hamiltonian (ZORA, DKH2, X2C) and picture-change settings.',
    snippet: '%rel\n  method ${1|ZORA,DKH,X2C|}\n  OneCenter ${2|true,false|}\nend',
    params: [
      { name: 'method', type: 'enum', summary: 'ZORA, DKH, X2C, IORA.' },
      { name: 'order', type: 'integer', defaultVal: '2', summary: 'DKH order (typically 2).' },
      { name: 'PictureChange', type: 'boolean', defaultVal: 'true', summary: 'Apply picture-change correction to property operators.' }
    ]
  }
];

export const SIMPLE_KEYWORD_MAP = new Map<string, KeywordDoc>();
for (const kw of ORCA6_SIMPLE_KEYWORDS) {
  SIMPLE_KEYWORD_MAP.set(kw.name.toLowerCase(), kw);
  // Also index solvation prefixes like cpcm / smd / alpb
  const base = kw.name.split('(')[0].toLowerCase();
  if (base !== kw.name.toLowerCase() && !SIMPLE_KEYWORD_MAP.has(base)) {
    SIMPLE_KEYWORD_MAP.set(base, { ...kw, name: kw.name.split('(')[0] });
  }
}

export const BLOCK_MAP = new Map<string, BlockDoc>();
for (const b of ORCA6_BLOCKS) {
  BLOCK_MAP.set(b.name.toLowerCase(), b);
}
