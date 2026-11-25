import * as path from 'path';
import { computeFormula, lookupElement } from '../data/elements';
import {
  Atom,
  AtomicCharge,
  ConvergenceCriterion,
  DipoleMoment,
  ExcitedState,
  GeometryFrame,
  OptCycle,
  OrbitalInfo,
  OutlineSection,
  ParsedOrcaData,
  ScfStep,
  Thermochemistry,
  VibrationalMode
} from './types';

export function isOrcaOutputContent(headText: string): boolean {
  return (
    headText.includes('* O   R   C   A *') ||
    headText.includes('O   R   C   A') ||
    headText.includes('Program Version 6.') ||
    headText.includes('Program Version 5.') ||
    headText.includes('CARTESIAN COORDINATES (ANGSTROEM)') ||
    headText.includes('FINAL SINGLE POINT ENERGY')
  );
}

export function parseOrcaOutput(content: string, filePath: string): ParsedOrcaData {
  const lines = content.split(/\r?\n/);
  const nLines = lines.length;

  let orcaVersion: string | undefined;
  let terminatedNormally = false;
  let optConverged = false;
  let runtime: string | undefined;
  let charge: number | undefined;
  let multiplicity: number | undefined;
  let finalEnergyEh: number | undefined;
  let mp2EnergyEh: number | undefined;

  const simpleInputKeywords: string[] = [];
  const frames: GeometryFrame[] = [];
  const optCycles: OptCycle[] = [];
  let currentCycle: OptCycle | undefined;
  let latestScfSteps: ScfStep[] = [];
  let orbitals: OrbitalInfo[] = [];
  let mullikenCharges: AtomicCharge[] = [];
  let loewdinCharges: AtomicCharge[] = [];
  let hirshfeldCharges: AtomicCharge[] = [];
  let dipole: DipoleMoment | undefined;
  let frequencies: VibrationalMode[] = [];
  let excitedStates: ExcitedState[] = [];
  let thermo: Thermochemistry | undefined;
  const errors: { line: number; message: string }[] = [];
  const warnings: { line: number; message: string }[] = [];
  const outline: OutlineSection[] = [];
  const cycleOutlineNodes: OutlineSection[] = [];

  // Track ghost & ECP flags by atom index (from CARTESIAN COORDINATES (A.U.))
  const ghostSet = new Set<number>();
  const ecpSet = new Set<number>();
  let inStationaryPointSection = false;
  let currentOrbitalSpin: 'alpha' | 'beta' | 'restricted' = 'restricted';

  const applyGhostAndEcpFlags = (atoms: Atom[]) => {
    for (const a of atoms) {
      if (ghostSet.has(a.index)) {
        a.isGhost = true;
      }
      if (ecpSet.has(a.index)) {
        a.hasEcp = true;
      }
    }
  };

  for (let i = 0; i < nLines; i++) {
    const line = lines[i];

    // 1. Program Version
    if (!orcaVersion && line.includes('Program Version')) {
      const m = line.match(/Program Version\s+([^\s]+)/);
      if (m) {
        orcaVersion = m[1];
        outline.push({
          label: `ORCA ${orcaVersion}`,
          line: i,
          category: 'header'
        });
      }
      continue;
    }

    // 2. Echoed input simple keywords & charge/mult
    if (line.startsWith('|') && line.includes('>')) {
      const after = line.slice(line.indexOf('>') + 1).trim();
      if (after.startsWith('!')) {
        simpleInputKeywords.push(...after.slice(1).trim().split(/\s+/).filter(Boolean));
      } else {
        const cm = after.match(/^\*\s*(?:xyz|xyzfile|int|gzmt)\s+([+-]?\d+)\s+(\d+)/i);
        if (cm && charge === undefined) {
          charge = parseInt(cm[1], 10);
          multiplicity = parseInt(cm[2], 10);
        }
      }
      continue;
    }

    // 3. Total Charge / Multiplicity from SCF input summary
    if (charge === undefined && line.includes('Total Charge')) {
      const m = line.match(/Total Charge\s+Charge\s+\.+\s+([+-]?\d+)/);
      if (m) {
        charge = parseInt(m[1], 10);
      }
    }
    if (multiplicity === undefined && line.includes('Multiplicity')) {
      const m = line.match(/Multiplicity\s+Mult\s+\.+\s+(\d+)/);
      if (m) {
        multiplicity = parseInt(m[1], 10);
      }
    }

    // 4. Geometry Optimization Cycle
    if (line.includes('GEOMETRY OPTIMIZATION CYCLE')) {
      const m = line.match(/GEOMETRY OPTIMIZATION CYCLE\s+(\d+)/);
      if (m) {
        const cycNum = parseInt(m[1], 10);
        currentCycle = {
          cycle: cycNum,
          line: i,
          criteria: []
        };
        optCycles.push(currentCycle);
        cycleOutlineNodes.push({
          label: `Cycle ${cycNum}`,
          line: i,
          category: 'cycle'
        });
      }
      continue;
    }

    // 5. Final energy evaluation at stationary point
    if (line.includes('FINAL ENERGY EVALUATION AT THE STATIONARY POINT')) {
      inStationaryPointSection = true;
      outline.push({
        label: 'Final Energy Evaluation (Stationary Point)',
        line: i,
        category: 'converged'
      });
      continue;
    }

    // 6. Cartesian Coordinates (Angstroem)
    if (line.trim() === 'CARTESIAN COORDINATES (ANGSTROEM)') {
      const startLine = i;
      const atoms: Atom[] = [];
      let j = i + 2; // skip dashed separator
      while (j < nLines) {
        const l = lines[j].trim();
        if (!l) {
          break;
        }
        const m = l.match(
          /^([A-Za-z]{1,2})\s*(:)?\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)/
        );
        if (!m) {
          break;
        }
        const idx = atoms.length;
        atoms.push({
          index: idx,
          element: lookupElement(m[1])?.symbol ?? m[1],
          isGhost: Boolean(m[2]) || ghostSet.has(idx),
          hasEcp: ecpSet.has(idx),
          x: parseFloat(m[3]),
          y: parseFloat(m[4]),
          z: parseFloat(m[5]),
          line: j
        });
        j++;
      }

      if (atoms.length > 0) {
        const frameIdx = frames.length;
        const label = inStationaryPointSection
          ? 'Final Converged Geometry'
          : currentCycle
            ? `Opt Cycle ${currentCycle.cycle}`
            : frameIdx === 0
              ? 'Input Geometry'
              : `Geometry ${frameIdx + 1}`;
        frames.push({
          index: frameIdx,
          label,
          atoms,
          line: startLine
        });
        if (currentCycle && currentCycle.frameIndex === undefined) {
          currentCycle.frameIndex = frameIdx;
        }
      }
      i = j - 1;
      continue;
    }

    // 7. Cartesian Coordinates (A.U.) -> detect ghost atoms (ZA=0, MASS=0) and ECP atoms (ZA with *)
    if (line.trim() === 'CARTESIAN COORDINATES (A.U.)') {
      let j = i + 3; // skip separator + header "NO LB ZA FRAG MASS X Y Z"
      let foundMeta = false;
      while (j < nLines) {
        const l = lines[j].trim();
        if (!l) {
          break;
        }
        const m = l.match(
          /^(\d+)\s+([A-Za-z]{1,2})\s+(\d+\.\d+)(\*)?\s+\d+\s+(\d+\.\d+)\s+/
        );
        if (!m) {
          break;
        }
        const idx = parseInt(m[1], 10);
        const za = parseFloat(m[3]);
        const hasStar = Boolean(m[4]);
        const mass = parseFloat(m[5]);
        if (za === 0 && mass === 0) {
          ghostSet.add(idx);
          foundMeta = true;
        }
        if (hasStar) {
          ecpSet.add(idx);
          foundMeta = true;
        }
        j++;
      }
      if (foundMeta && frames.length > 0) {
        applyGhostAndEcpFlags(frames[frames.length - 1].atoms);
      }
      i = j - 1;
      continue;
    }

    // 8. SCF Iterations (ORCA 6 LEAN-SCF and classic SCF ITERATIONS)
    if (
      line.trim() === 'SCF ITERATIONS' ||
      line.includes('ORCA LEAN-SCF') ||
      /^Iteration\s+Energy\s*\(Eh\)\s+Delta-E/i.test(line.trim())
    ) {
      const steps: ScfStep[] = [];
      let j = i + 1;
      while (j < nLines) {
        const l = lines[j].trim();
        if (
          l.includes('SCF CONVERGED AFTER') ||
          l.includes('SCF NOT CONVERGED') ||
          l === 'TOTAL SCF ENERGY' ||
          l.includes('ORCA TERMINATED')
        ) {
          break;
        }
        const m = l.match(
          /^(\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d+\.\d+(?:[eE][+-]?\d+)?)(?:\s+([+-]?\d+\.\d+(?:[eE][+-]?\d+)?))?/
        );
        if (m) {
          steps.push({
            iter: parseInt(m[1], 10),
            energy: parseFloat(m[2]),
            deltaE: parseFloat(m[3]),
            rmsDP: parseFloat(m[4]),
            maxDP: m[5] ? parseFloat(m[5]) : undefined
          });
        }
        j++;
        if (j - i > 2000) {
          break;
        }
      }
      if (steps.length > 0) {
        latestScfSteps = steps;
      }
      i = j - 1;
      continue;
    }

    // 9. MP2 TOTAL ENERGY
    if (line.includes('MP2 TOTAL ENERGY:')) {
      const m = line.match(/MP2 TOTAL ENERGY:\s+([+-]?\d+\.\d+)/);
      if (m) {
        mp2EnergyEh = parseFloat(m[1]);
        if (currentCycle) {
          currentCycle.mp2Energy = mp2EnergyEh;
        }
      }
      continue;
    }

    // 10. FINAL SINGLE POINT ENERGY
    if (line.includes('FINAL SINGLE POINT ENERGY')) {
      const m = line.match(/FINAL SINGLE POINT ENERGY\s+([+-]?\d+\.\d+)/);
      if (m) {
        finalEnergyEh = parseFloat(m[1]);
        if (currentCycle && !inStationaryPointSection) {
          currentCycle.energy = finalEnergyEh;
          if (cycleOutlineNodes.length > 0) {
            cycleOutlineNodes[cycleOutlineNodes.length - 1].detail = `${finalEnergyEh.toFixed(6)} Eh`;
          }
        }
        if (frames.length > 0 && frames[frames.length - 1].energy === undefined) {
          frames[frames.length - 1].energy = finalEnergyEh;
        }
        if (optCycles.length === 0 || inStationaryPointSection) {
          outline.push({
            label: 'Final Single Point Energy',
            detail: `${finalEnergyEh.toFixed(8)} Eh`,
            line: i,
            category: 'energy'
          });
        }
      }
      continue;
    }

    // 11. Geometry convergence table
    if (line.includes('|Geometry convergence|')) {
      const criteria: ConvergenceCriterion[] = [];
      let j = i + 3; // skip Item header and dashed line
      while (j < nLines) {
        const l = lines[j].trim();
        if (!l || l.startsWith('----') || l.startsWith('....')) {
          break;
        }
        const m = l.match(
          /^(Energy change|RMS gradient|MAX gradient|RMS step|MAX step)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+(YES|NO)/i
        );
        if (m) {
          const item = m[1];
          const val = parseFloat(m[2]);
          const tol = parseFloat(m[3]);
          const conv = m[4].toUpperCase() === 'YES';
          criteria.push({ item, value: val, tolerance: tol, converged: conv });
          if (currentCycle) {
            const lower = item.toLowerCase();
            if (lower === 'energy change') {
              currentCycle.energyChange = val;
              currentCycle.energyChangeTol = tol;
            } else if (lower === 'rms gradient') {
              currentCycle.rmsGrad = val;
              currentCycle.rmsGradTol = tol;
            } else if (lower === 'max gradient') {
              currentCycle.maxGrad = val;
              currentCycle.maxGradTol = tol;
            } else if (lower === 'rms step') {
              currentCycle.rmsStep = val;
              currentCycle.rmsStepTol = tol;
            } else if (lower === 'max step') {
              currentCycle.maxStep = val;
              currentCycle.maxStepTol = tol;
            }
          }
        }
        j++;
      }
      if (currentCycle) {
        currentCycle.criteria = criteria;
        currentCycle.converged = criteria.length > 0 && criteria.every((c) => c.converged);
      }
      i = j - 1;
      continue;
    }

    // 12. HURRAY (Opt converged)
    if (line.includes('HURRAY') || line.includes('THE OPTIMIZATION HAS CONVERGED')) {
      if (!optConverged) {
        optConverged = true;
        outline.push({
          label: 'HURRAY — Optimization Converged',
          detail: `${optCycles.length} cycles`,
          line: i,
          category: 'converged'
        });
      }
      continue;
    }

    // 13. Orbital Energies
    if (line.trim() === 'ORBITAL ENERGIES') {
      const startLine = i;
      const parsed: OrbitalInfo[] = [];
      currentOrbitalSpin = 'restricted';
      let j = i + 2;
      while (j < nLines) {
        const l = lines[j].trim();
        if (l.includes('SPIN UP ORBITALS')) {
          currentOrbitalSpin = 'alpha';
          j++;
          continue;
        }
        if (l.includes('SPIN DOWN ORBITALS')) {
          currentOrbitalSpin = 'beta';
          j++;
          continue;
        }
        if (l.startsWith('NO') && l.includes('OCC')) {
          j++;
          continue;
        }
        if (l.startsWith('----') || l.startsWith('****') || l.startsWith('MULLIKEN')) {
          break;
        }
        const m = l.match(/^(\d+)\s+(\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)/);
        if (m) {
          parsed.push({
            index: parseInt(m[1], 10),
            spin: currentOrbitalSpin,
            occ: parseFloat(m[2]),
            energyEh: parseFloat(m[3]),
            energyEv: parseFloat(m[4])
          });
        } else if (l === '' && parsed.length > 0) {
          // Check if SPIN DOWN follows right after blank line
          const nextNonEmpty = lines[j + 1]?.trim() ?? '';
          if (!nextNonEmpty.includes('SPIN DOWN')) {
            break;
          }
        }
        j++;
      }
      if (parsed.length > 0) {
        orbitals = parsed;
        if (optCycles.length === 0 || inStationaryPointSection) {
          outline.push({
            label: 'Orbital Energies',
            detail: `${parsed.length} orbitals`,
            line: startLine,
            category: 'orbitals'
          });
        }
      }
      i = j - 1;
      continue;
    }

    // 14. Atomic Charges (Mulliken, Loewdin, Hirshfeld)
    if (line.trim() === 'MULLIKEN ATOMIC CHARGES') {
      const startLine = i;
      const list: AtomicCharge[] = [];
      let j = i + 2;
      while (j < nLines) {
        const l = lines[j].trim();
        if (!l || l.startsWith('Sum of atomic')) {
          break;
        }
        const m = l.match(/^(\d+)\s+([A-Za-z]{1,2})\s*:\s*([+-]?\d+\.\d+)/);
        if (m) {
          list.push({
            atomIndex: parseInt(m[1], 10),
            element: m[2],
            charge: parseFloat(m[3])
          });
        }
        j++;
      }
      if (list.length > 0) {
        mullikenCharges = list;
        if (optCycles.length === 0 || inStationaryPointSection) {
          outline.push({
            label: 'Mulliken Atomic Charges',
            line: startLine,
            category: 'charges'
          });
        }
      }
      i = j - 1;
      continue;
    }

    if (line.trim() === 'LOEWDIN ATOMIC CHARGES') {
      const startLine = i;
      const list: AtomicCharge[] = [];
      let j = i + 2;
      while (j < nLines) {
        const l = lines[j].trim();
        if (!l || l.startsWith('----') || l.startsWith('LOEWDIN')) {
          break;
        }
        const m = l.match(/^(\d+)\s+([A-Za-z]{1,2})\s*:\s*([+-]?\d+\.\d+)/);
        if (m) {
          list.push({
            atomIndex: parseInt(m[1], 10),
            element: m[2],
            charge: parseFloat(m[3])
          });
        }
        j++;
      }
      if (list.length > 0) {
        loewdinCharges = list;
        if (optCycles.length === 0 || inStationaryPointSection) {
          outline.push({
            label: 'Loewdin Atomic Charges',
            line: startLine,
            category: 'charges'
          });
        }
      }
      i = j - 1;
      continue;
    }

    if (line.trim() === 'HIRSHFELD ANALYSIS') {
      const startLine = i;
      const list: AtomicCharge[] = [];
      let j = i + 2;
      while (j < nLines && j - i < 5000) {
        const l = lines[j].trim();
        if (l.startsWith('TOTAL')) {
          break;
        }
        const m = l.match(/^(\d+)\s+([A-Za-z]{1,2})\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)/);
        if (m) {
          list.push({
            atomIndex: parseInt(m[1], 10),
            element: m[2],
            charge: parseFloat(m[3])
          });
        }
        j++;
      }
      if (list.length > 0) {
        hirshfeldCharges = list;
        outline.push({
          label: 'Hirshfeld Analysis',
          line: startLine,
          category: 'charges'
        });
      }
      i = j - 1;
      continue;
    }

    // 15. Dipole Moment
    if (line.includes('Total Dipole Moment') && line.includes(':')) {
      const vecMatch = line.match(
        /Total Dipole Moment\s*:\s*([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)/
      );
      if (vecMatch) {
        let magAu = Math.hypot(
          parseFloat(vecMatch[1]),
          parseFloat(vecMatch[2]),
          parseFloat(vecMatch[3])
        );
        let magDebye = magAu * 2.541746;
        for (let k = i + 1; k < Math.min(nLines, i + 6); k++) {
          const ma = lines[k].match(/Magnitude \(a\.u\.\)\s*:\s*([+-]?\d+\.\d+)/);
          if (ma) {
            magAu = parseFloat(ma[1]);
          }
          const md = lines[k].match(/Magnitude \(Debye\)\s*:\s*([+-]?\d+\.\d+)/);
          if (md) {
            magDebye = parseFloat(md[1]);
          }
        }
        dipole = {
          x: parseFloat(vecMatch[1]),
          y: parseFloat(vecMatch[2]),
          z: parseFloat(vecMatch[3]),
          magnitudeAu: magAu,
          magnitudeDebye: magDebye
        };
        if (optCycles.length === 0 || inStationaryPointSection) {
          outline.push({
            label: 'Dipole Moment',
            detail: `${magDebye.toFixed(3)} Debye`,
            line: i,
            category: 'dipole'
          });
        }
      }
      continue;
    }

    // 16. Vibrational Frequencies
    if (line.trim() === 'VIBRATIONAL FREQUENCIES') {
      const startLine = i;
      const modes: VibrationalMode[] = [];
      let j = i + 2;
      while (j < nLines) {
        const l = lines[j].trim();
        if (
          modes.length > 0 &&
          (l === '' ||
            l === 'NORMAL MODES' ||
            l === 'IR SPECTRUM' ||
            l.startsWith('THERMOCHEMISTRY') ||
            l.startsWith('----') ||
            l.includes('ORCA TERMINATED'))
        ) {
          break;
        }
        const m = l.match(/^(\d+):\s+([+-]?\d+\.\d+)\s+cm\*\*-1(.*)$/);
        if (m) {
          const freq = parseFloat(m[2]);
          const isImag = freq < 0 || m[3].toLowerCase().includes('imaginary');
          modes.push({
            mode: parseInt(m[1], 10),
            frequency: freq,
            isImaginary: isImag
          });
        }
        j++;
      }
      if (modes.length > 0) {
        frequencies = modes;
        const nImag = modes.filter((f) => f.isImaginary).length;
        outline.push({
          label: 'Vibrational Frequencies',
          detail:
            nImag > 0
              ? `${modes.length} modes (${nImag} imaginary!)`
              : `${modes.length} modes (0 imaginary)`,
          line: startLine,
          category: 'freq'
        });
      }
      i = j - 1;
      continue;
    }

    // 17. Normal Modes Matrix
    if (line.trim() === 'NORMAL MODES') {
      const nAtoms = frames.length > 0 ? frames[frames.length - 1].atoms.length : 0;
      const dim = nAtoms * 3;
      if (dim > 0 && frequencies.length > 0) {
        // Initialize matrix[coordIndex][modeIndex]
        const modeVectors: number[][] = Array.from({ length: frequencies.length }, () =>
          new Array<number>(dim).fill(0)
        );
        let j = i + 2;
        while (j < nLines) {
          const l = lines[j].trim();
          if (l === 'IR SPECTRUM' || l.startsWith('THERMOCHEMISTRY')) {
            break;
          }
          // Column header line: integers only (e.g. "0  1  2  3  4  5")
          if (/^\d+(\s+\d+)*$/.test(l)) {
            const colModes = l.split(/\s+/).map((s) => parseInt(s, 10));
            j++;
            while (j < nLines) {
              const rowLine = lines[j].trim();
              if (!rowLine) {
                break;
              }
              const parts = rowLine.split(/\s+/);
              if (parts.length < colModes.length + 1 || !/^\d+$/.test(parts[0])) {
                j--;
                break;
              }
              const coordIdx = parseInt(parts[0], 10);
              if (coordIdx >= 0 && coordIdx < dim) {
                for (let c = 0; c < colModes.length; c++) {
                  const mIdx = colModes[c];
                  if (mIdx >= 0 && mIdx < modeVectors.length) {
                    modeVectors[mIdx][coordIdx] = parseFloat(parts[c + 1]);
                  }
                }
              }
              j++;
            }
          }
          j++;
        }

        // Convert to per-atom displacements
        for (const mode of frequencies) {
          const vec = modeVectors[mode.mode];
          if (!vec) {
            continue;
          }
          const disps: { dx: number; dy: number; dz: number }[] = [];
          for (let a = 0; a < nAtoms; a++) {
            disps.push({
              dx: vec[a * 3],
              dy: vec[a * 3 + 1],
              dz: vec[a * 3 + 2]
            });
          }
          mode.displacements = disps;
        }
        i = j - 1;
      }
      continue;
    }

    // 18. IR Spectrum (ORCA 6 format: Mode freq eps Int T**2 (TX TY TZ))
    if (line.trim() === 'IR SPECTRUM') {
      const startLine = i;
      const modeById = new Map<number, VibrationalMode>();
      for (const f of frequencies) {
        modeById.set(f.mode, f);
      }
      let count = 0;
      let j = i + 2;
      while (j < nLines) {
        const l = lines[j].trim();
        if (l.startsWith('The first frequency') || l.startsWith('THERMOCHEMISTRY')) {
          break;
        }
        // e.g. "  6:    384.22   0.000018    0.09  0.000015  ( 0.000000 -0.000000  0.003835)"
        const m = l.match(
          /^(\d+):\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)/
        );
        if (m) {
          const modeIdx = parseInt(m[1], 10);
          const freqVal = parseFloat(m[2]);
          const eps = parseFloat(m[3]);
          const irInt = parseFloat(m[4]);
          const t2 = parseFloat(m[5]);
          const existing = modeById.get(modeIdx);
          if (existing) {
            existing.eps = eps;
            existing.irIntensity = irInt;
            existing.tSquared = t2;
          } else {
            const added: VibrationalMode = {
              mode: modeIdx,
              frequency: freqVal,
              isImaginary: freqVal < 0,
              eps,
              irIntensity: irInt,
              tSquared: t2
            };
            frequencies.push(added);
            modeById.set(modeIdx, added);
          }
          count++;
        }
        j++;
      }
      if (count > 0) {
        outline.push({
          label: 'IR Spectrum',
          detail: `${count} active modes`,
          line: startLine,
          category: 'spectrum'
        });
      }
      i = j - 1;
      continue;
    }

    // 19. TD-DFT / Absorption Spectrum (supports ORCA 6 & classic formats)
    if (
      line.includes('ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS') &&
      !line.includes('VELOCITY')
    ) {
      const startLine = i;
      const states: ExcitedState[] = [];
      let j = i + 2;
      while (j < nLines) {
        const l = lines[j].trim();
        if (!l && states.length > 0) {
          break;
        }
        if (l.includes('ABSORPTION SPECTRUM VIA TRANSITION VELOCITY')) {
          break;
        }
        // ORCA 6 format: "  0-1A  ->  1-1A   3.4521  27843.1   359.2   0.123456789   ..."
        const m6 = l.match(
          /^(\S+\s*->\s*\S+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)/
        );
        if (m6) {
          states.push({
            state: states.length + 1,
            transition: m6[1].replace(/\s+/g, ' '),
            energyEv: parseFloat(m6[2]),
            energyCm1: parseFloat(m6[3]),
            wavelengthNm: parseFloat(m6[4]),
            fosc: parseFloat(m6[5])
          });
          j++;
          continue;
        }
        // Classic ORCA format: "   1   27843.1    359.2   0.123456789   ..."
        const m5 = l.match(
          /^(\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)/
        );
        if (m5) {
          const cm1 = parseFloat(m5[2]);
          const nm = parseFloat(m5[3]);
          const fosc = parseFloat(m5[4]);
          states.push({
            state: parseInt(m5[1], 10),
            transition: `S0 -> S${m5[1]}`,
            energyEv: cm1 / 8065.54429,
            energyCm1: cm1,
            wavelengthNm: nm,
            fosc
          });
        }
        j++;
      }
      if (states.length > 0) {
        excitedStates = states;
        outline.push({
          label: 'UV-Vis Absorption Spectrum (TD-DFT)',
          detail: `${states.length} transitions`,
          line: startLine,
          category: 'spectrum'
        });
      }
      i = j - 1;
      continue;
    }

    // 20. Thermochemistry
    if (line.includes('THERMOCHEMISTRY AT')) {
      const startLine = i;
      const t: Thermochemistry = {};
      const tm = line.match(/THERMOCHEMISTRY AT\s+([\d.]+)\s*K/);
      if (tm) {
        t.temperatureK = parseFloat(tm[1]);
      }
      let j = i + 1;
      while (j < nLines && j - i < 220) {
        const l = lines[j];
        if (l.includes('SUGGESTED CITATIONS') || l.includes('ORCA TERMINATED')) {
          break;
        }
        let m: RegExpMatchArray | null;
        if ((m = l.match(/Temperature\s+\.+\s+([\d.]+)\s*K/))) {
          t.temperatureK = parseFloat(m[1]);
        } else if ((m = l.match(/Pressure\s+\.+\s+([\d.]+)\s*atm/))) {
          t.pressureAtm = parseFloat(m[1]);
        } else if ((m = l.match(/Total Mass\s+\.+\s+([\d.]+)\s*AMU/))) {
          t.totalMassAmu = parseFloat(m[1]);
        } else if ((m = l.match(/Point Group:\s+(\S+?)(?:,|\s)/))) {
          t.pointGroup = m[1];
        } else if ((m = l.match(/Electronic energy\s+\.+\s+([+-]?\d+\.\d+)\s*Eh/))) {
          t.electronicEnergyEh = parseFloat(m[1]);
        } else if (
          (m = l.match(/Zero point energy\s+\.+\s+([+-]?\d+\.\d+)\s*Eh\s+([+-]?\d+\.\d+)\s*kcal/))
        ) {
          t.zpeEh = parseFloat(m[1]);
          t.zpeKcal = parseFloat(m[2]);
        } else if ((m = l.match(/Total thermal energy\s+([+-]?\d+\.\d+)\s*Eh/))) {
          t.totalThermalEnergyEh = parseFloat(m[1]);
        } else if ((m = l.match(/Total Enthalpy\s+\.+\s+([+-]?\d+\.\d+)\s*Eh/))) {
          t.totalEnthalpyEh = parseFloat(m[1]);
        } else if ((m = l.match(/Final entropy term\s+\.+\s+([+-]?\d+\.\d+)\s*Eh/))) {
          t.finalEntropyEh = parseFloat(m[1]);
        } else if ((m = l.match(/Final Gibbs free energy\s+\.+\s+([+-]?\d+\.\d+)\s*Eh/))) {
          t.finalGibbsEh = parseFloat(m[1]);
        } else if (
          (m = l.match(/G-E\(el\)\s+\.+\s+([+-]?\d+\.\d+)\s*Eh\s+([+-]?\d+\.\d+)\s*kcal/))
        ) {
          t.gMinusEelEh = parseFloat(m[1]);
          t.gMinusEelKcal = parseFloat(m[2]);
        }
        j++;
      }
      thermo = t;
      outline.push({
        label: `Thermochemistry (${t.temperatureK ?? 298.15} K)`,
        detail:
          t.finalGibbsEh !== undefined ? `G = ${t.finalGibbsEh.toFixed(6)} Eh` : undefined,
        line: startLine,
        category: 'thermo'
      });
      i = j - 1;
      continue;
    }

    // 21. Errors & Warnings
    if (
      line.includes('ORCA finished by error termination') ||
      line.includes('ABORTING THE RUN') ||
      /^\s*Error\s*:/i.test(line) ||
      line.includes('!!!   FATAL ERROR')
    ) {
      const msg = line.trim();
      errors.push({ line: i, message: msg });
      outline.push({
        label: `Error: ${msg.slice(0, 50)}`,
        line: i,
        category: 'error'
      });
      continue;
    }

    if (/^\s*WARNING:/i.test(line) && warnings.length < 30) {
      warnings.push({ line: i, message: line.trim() });
      continue;
    }

    // 22. Normal Termination & Runtime
    if (line.includes('****ORCA TERMINATED NORMALLY****')) {
      terminatedNormally = true;
      outline.push({
        label: 'ORCA Terminated Normally',
        line: i,
        category: 'converged'
      });
      continue;
    }

    if (line.includes('TOTAL RUN TIME:')) {
      runtime = line.replace(/^.*TOTAL RUN TIME:\s*/, '').trim();
      continue;
    }
  }

  // Apply ghost/ECP flags retroactively to all frames if discovered after frame 0
  if (ghostSet.size > 0 || ecpSet.size > 0) {
    for (const f of frames) {
      applyGhostAndEcpFlags(f.atoms);
    }
  }

  // Group optimization cycles nicely in outline
  if (cycleOutlineNodes.length > 0) {
    const insertIdx = Math.min(1, outline.length);
    outline.splice(insertIdx, 0, {
      label: `Optimization Cycles (${cycleOutlineNodes.length})`,
      detail: optConverged ? 'Converged' : 'In progress / unconverged',
      line: cycleOutlineNodes[0].line,
      category: 'cycle',
      children: cycleOutlineNodes
    });
  }

  // Compute HOMO / LUMO / Gap
  let homoEv: number | undefined;
  let lumoEv: number | undefined;
  let homoLumoGapEv: number | undefined;
  if (orbitals.length > 0) {
    const occupied = orbitals.filter((o) => o.occ > 0.01);
    const virtual = orbitals.filter((o) => o.occ <= 0.01);
    if (occupied.length > 0) {
      homoEv = Math.max(...occupied.map((o) => o.energyEv));
    }
    if (virtual.length > 0) {
      lumoEv = Math.min(...virtual.map((o) => o.energyEv));
    }
    if (homoEv !== undefined && lumoEv !== undefined) {
      homoLumoGapEv = lumoEv - homoEv;
    }
  }

  const lastAtoms = frames.length > 0 ? frames[frames.length - 1].atoms : [];
  // Attach Mulliken charges to last frame atoms by default if sizes match
  if (mullikenCharges.length === lastAtoms.length) {
    for (const c of mullikenCharges) {
      if (lastAtoms[c.atomIndex]) {
        lastAtoms[c.atomIndex].charge = c.charge;
      }
    }
  }

  const imaginaryCount = frequencies.filter((f) => f.isImaginary).length;
  const status: ParsedOrcaData['status'] =
    errors.length > 0
      ? 'error'
      : terminatedNormally
        ? optConverged
          ? 'converged'
          : 'normal'
        : 'running';

  return {
    filePath,
    fileName: path.basename(filePath),
    fileType: 'orca-output',
    orcaVersion,
    status,
    runtime,
    formula: computeFormula(lastAtoms),
    nAtoms: lastAtoms.length,
    nGhostAtoms: lastAtoms.filter((a) => a.isGhost).length,
    charge,
    multiplicity,
    simpleInputKeywords: Array.from(new Set(simpleInputKeywords)),
    finalEnergyEh,
    mp2EnergyEh,
    optConverged,
    frames,
    optCycles,
    scfSteps: latestScfSteps,
    orbitals,
    homoEv,
    lumoEv,
    homoLumoGapEv,
    mullikenCharges,
    loewdinCharges,
    hirshfeldCharges,
    dipole,
    frequencies,
    imaginaryCount,
    excitedStates,
    thermo,
    errors,
    warnings,
    outline
  };
}
