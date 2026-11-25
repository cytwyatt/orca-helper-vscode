export interface Atom {
  index: number; // 0-based ORCA atom index
  element: string;
  x: number; // Angstrom
  y: number;
  z: number;
  isGhost?: boolean;
  hasEcp?: boolean;
  fragment?: number;
  line?: number; // 0-based line in source file
  charge?: number; // optional atomic charge
  gx?: number; // optional gradient vector (Eh/bohr)
  gy?: number;
  gz?: number;
}

export interface GeometryFrame {
  index: number; // 0-based frame index
  label: string;
  atoms: Atom[];
  energy?: number; // Eh
  line?: number; // 0-based line in source file
  comment?: string;
}

export interface ConvergenceCriterion {
  item: string;
  value: number;
  tolerance: number;
  converged: boolean;
}

export interface OptCycle {
  cycle: number; // 1-based cycle number
  line: number; // 0-based line number
  energy?: number; // Eh (FINAL SINGLE POINT ENERGY)
  mp2Energy?: number; // Eh
  energyChange?: number;
  rmsGrad?: number;
  maxGrad?: number;
  rmsStep?: number;
  maxStep?: number;
  rmsGradTol?: number;
  maxGradTol?: number;
  rmsStepTol?: number;
  maxStepTol?: number;
  energyChangeTol?: number;
  converged?: boolean;
  criteria: ConvergenceCriterion[];
  frameIndex?: number; // index into frames[]
}

export interface ScfStep {
  iter: number;
  energy: number;
  deltaE?: number;
  rmsDP?: number;
  maxDP?: number;
}

export interface OrbitalInfo {
  index: number;
  spin: 'alpha' | 'beta' | 'restricted';
  occ: number;
  energyEh: number;
  energyEv: number;
}

export interface AtomicCharge {
  atomIndex: number;
  element: string;
  charge: number;
}

export interface VibrationalMode {
  mode: number; // 0-based ORCA mode index
  frequency: number; // cm^-1 (negative for imaginary)
  isImaginary: boolean;
  irIntensity?: number; // km/mol
  eps?: number; // L/(mol*cm)
  tSquared?: number; // a.u.
  // Normal mode Cartesian displacements per atom: length = nAtoms
  displacements?: { dx: number; dy: number; dz: number }[];
}

export interface ExcitedState {
  state: number;
  transition: string;
  energyEv: number;
  energyCm1: number;
  wavelengthNm: number;
  fosc: number;
}

export interface Thermochemistry {
  temperatureK?: number;
  pressureAtm?: number;
  totalMassAmu?: number;
  pointGroup?: string;
  electronicEnergyEh?: number;
  zpeEh?: number;
  zpeKcal?: number;
  totalThermalEnergyEh?: number;
  totalEnthalpyEh?: number;
  finalEntropyEh?: number;
  finalGibbsEh?: number;
  gMinusEelEh?: number;
  gMinusEelKcal?: number;
}

export interface DipoleMoment {
  x: number; // a.u.
  y: number;
  z: number;
  magnitudeAu: number;
  magnitudeDebye: number;
}

export interface OutlineSection {
  label: string;
  detail?: string;
  line: number; // 0-based
  category:
    | 'header'
    | 'cycle'
    | 'energy'
    | 'scf'
    | 'converged'
    | 'orbitals'
    | 'charges'
    | 'dipole'
    | 'freq'
    | 'spectrum'
    | 'thermo'
    | 'error'
    | 'warning'
    | 'block'
    | 'coords'
    | 'job';
  children?: OutlineSection[];
}

export interface ParsedOrcaData {
  filePath: string;
  fileName: string;
  fileType: 'orca-input' | 'orca-output' | 'xyz' | 'hess' | 'engrad';
  orcaVersion?: string;
  status: 'normal' | 'converged' | 'error' | 'running' | 'input' | 'structure';
  runtime?: string;
  formula: string;
  nAtoms: number;
  nGhostAtoms: number;
  charge?: number;
  multiplicity?: number;
  simpleInputKeywords?: string[];
  finalEnergyEh?: number;
  mp2EnergyEh?: number;
  optConverged?: boolean;
  frames: GeometryFrame[];
  optCycles: OptCycle[];
  scfSteps: ScfStep[];
  orbitals: OrbitalInfo[];
  homoEv?: number;
  lumoEv?: number;
  homoLumoGapEv?: number;
  mullikenCharges: AtomicCharge[];
  loewdinCharges: AtomicCharge[];
  hirshfeldCharges: AtomicCharge[];
  dipole?: DipoleMoment;
  frequencies: VibrationalMode[];
  imaginaryCount: number;
  excitedStates: ExcitedState[];
  thermo?: Thermochemistry;
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
  outline: OutlineSection[];
}
