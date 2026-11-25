import * as path from 'path';
import { computeFormula, ELEMENT_BY_Z, lookupElement } from '../data/elements';
import { Atom, OutlineSection, ParsedOrcaData, VibrationalMode } from './types';

const BOHR_TO_ANGSTROM = 0.529177210903;

export function parseHessContent(content: string, filePath: string): ParsedOrcaData {
  const lines = content.split(/\r?\n/);
  const nLines = lines.length;
  const atoms: Atom[] = [];
  const frequencies: VibrationalMode[] = [];
  const outline: OutlineSection[] = [];
  let energy: number | undefined;
  let multiplicity: number | undefined;
  let modeVectors: number[][] = [];

  for (let i = 0; i < nLines; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === '$act_energy' && i + 1 < nLines) {
      const val = parseFloat(lines[i + 1].trim());
      if (!isNaN(val) && val !== 0) {
        energy = val;
      }
      continue;
    }

    if (trimmed === '$multiplicity' && i + 1 < nLines) {
      const val = parseInt(lines[i + 1].trim(), 10);
      if (!isNaN(val)) {
        multiplicity = val;
      }
      continue;
    }

    if (trimmed === '$atoms' && i + 1 < nLines) {
      outline.push({ label: '$atoms', line: i, category: 'coords' });
      const count = parseInt(lines[i + 1].trim(), 10);
      if (!isNaN(count) && count > 0) {
        for (let k = 0; k < count && i + 2 + k < nLines; k++) {
          const parts = lines[i + 2 + k].trim().split(/\s+/);
          if (parts.length >= 5) {
            const el = lookupElement(parts[0])?.symbol ?? parts[0];
            atoms.push({
              index: k,
              element: el,
              x: parseFloat(parts[2]) * BOHR_TO_ANGSTROM,
              y: parseFloat(parts[3]) * BOHR_TO_ANGSTROM,
              z: parseFloat(parts[4]) * BOHR_TO_ANGSTROM,
              line: i + 2 + k
            });
          }
        }
        i += count + 1;
      }
      continue;
    }

    if (trimmed === '$vibrational_frequencies' && i + 1 < nLines) {
      outline.push({ label: '$vibrational_frequencies', line: i, category: 'freq' });
      const count = parseInt(lines[i + 1].trim(), 10);
      if (!isNaN(count) && count > 0) {
        for (let k = 0; k < count && i + 2 + k < nLines; k++) {
          const parts = lines[i + 2 + k].trim().split(/\s+/);
          if (parts.length >= 2) {
            const modeIdx = parseInt(parts[0], 10);
            const freq = parseFloat(parts[1]);
            frequencies.push({
              mode: modeIdx,
              frequency: freq,
              isImaginary: freq < 0
            });
          }
        }
        i += count + 1;
      }
      continue;
    }

    if (trimmed === '$normal_modes' && i + 1 < nLines) {
      outline.push({ label: '$normal_modes', line: i, category: 'freq' });
      const dims = lines[i + 1].trim().split(/\s+/).map((s) => parseInt(s, 10));
      const nRows = dims[0];
      const nCols = dims[1] ?? nRows;
      if (!isNaN(nRows) && nRows > 0) {
        modeVectors = Array.from({ length: nCols }, () => new Array<number>(nRows).fill(0));
        let j = i + 2;
        while (j < nLines) {
          const l = lines[j].trim();
          if (l.startsWith('$')) {
            break;
          }
          if (/^\d+(\s+\d+)*$/.test(l)) {
            const cols = l.split(/\s+/).map((s) => parseInt(s, 10));
            j++;
            for (let r = 0; r < nRows && j < nLines; r++, j++) {
              const parts = lines[j].trim().split(/\s+/);
              if (parts.length < cols.length + 1) {
                break;
              }
              const rowIdx = parseInt(parts[0], 10);
              for (let c = 0; c < cols.length; c++) {
                const colIdx = cols[c];
                if (colIdx < nCols && rowIdx < nRows) {
                  modeVectors[colIdx][rowIdx] = parseFloat(parts[c + 1]);
                }
              }
            }
          } else {
            j++;
          }
        }
        i = j - 1;
      }
      continue;
    }

    if (trimmed === '$ir_spectrum' && i + 1 < nLines) {
      outline.push({ label: '$ir_spectrum', line: i, category: 'spectrum' });
      const count = parseInt(lines[i + 1].trim(), 10);
      if (!isNaN(count) && count > 0) {
        for (let k = 0; k < count && i + 2 + k < nLines; k++) {
          const parts = lines[i + 2 + k].trim().split(/\s+/);
          // ORCA 6 .hess $ir_spectrum: freq  eps  Int  T**2  TX  TY  TZ
          if (parts.length >= 4 && frequencies[k]) {
            frequencies[k].eps = parseFloat(parts[1]);
            frequencies[k].irIntensity = parseFloat(parts[2]);
            frequencies[k].tSquared = parseFloat(parts[3]);
          }
        }
        i += count + 1;
      }
      continue;
    }
  }

  // Attach displacements to frequencies
  if (atoms.length > 0 && modeVectors.length > 0) {
    for (const mode of frequencies) {
      const vec = modeVectors[mode.mode];
      if (!vec || vec.length < atoms.length * 3) {
        continue;
      }
      const disps: { dx: number; dy: number; dz: number }[] = [];
      for (let a = 0; a < atoms.length; a++) {
        disps.push({ dx: vec[a * 3], dy: vec[a * 3 + 1], dz: vec[a * 3 + 2] });
      }
      mode.displacements = disps;
    }
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    fileType: 'hess',
    status: 'structure',
    formula: computeFormula(atoms),
    nAtoms: atoms.length,
    nGhostAtoms: 0,
    multiplicity,
    finalEnergyEh: energy,
    frames:
      atoms.length > 0
        ? [{ index: 0, label: 'Hessian Geometry', atoms, energy, line: 0 }]
        : [],
    optCycles: [],
    scfSteps: [],
    orbitals: [],
    mullikenCharges: [],
    loewdinCharges: [],
    hirshfeldCharges: [],
    frequencies,
    imaginaryCount: frequencies.filter((f) => f.isImaginary).length,
    excitedStates: [],
    errors: [],
    warnings: [],
    outline
  };
}

export function parseEngradContent(content: string, filePath: string): ParsedOrcaData {
  const rawLines = content.split(/\r?\n/);
  const dataLines: { line: number; text: string }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (t && !t.startsWith('#')) {
      dataLines.push({ line: i, text: t });
    }
  }

  const atoms: Atom[] = [];
  let energy: number | undefined;
  const outline: OutlineSection[] = [];

  if (dataLines.length >= 2) {
    const nAtoms = parseInt(dataLines[0].text, 10);
    energy = parseFloat(dataLines[1].text);
    outline.push({
      label: `Total Energy`,
      detail: `${energy.toFixed(8)} Eh`,
      line: dataLines[1].line,
      category: 'energy'
    });

    const gradStart = 2;
    const coordStart = gradStart + nAtoms * 3;
    const grads: number[] = [];
    for (let k = 0; k < nAtoms * 3 && gradStart + k < dataLines.length; k++) {
      grads.push(parseFloat(dataLines[gradStart + k].text));
    }

    if (coordStart < dataLines.length) {
      outline.push({
        label: `Coordinates & Gradients (${nAtoms} atoms)`,
        line: dataLines[coordStart].line,
        category: 'coords'
      });
    }

    for (let a = 0; a < nAtoms && coordStart + a < dataLines.length; a++) {
      const parts = dataLines[coordStart + a].text.split(/\s+/);
      if (parts.length >= 4) {
        const z = parseInt(parts[0], 10);
        const el = ELEMENT_BY_Z.get(z)?.symbol ?? String(z);
        atoms.push({
          index: a,
          element: el,
          x: parseFloat(parts[1]) * BOHR_TO_ANGSTROM,
          y: parseFloat(parts[2]) * BOHR_TO_ANGSTROM,
          z: parseFloat(parts[3]) * BOHR_TO_ANGSTROM,
          gx: grads[a * 3],
          gy: grads[a * 3 + 1],
          gz: grads[a * 3 + 2],
          line: dataLines[coordStart + a].line
        });
      }
    }
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    fileType: 'engrad',
    status: 'structure',
    formula: computeFormula(atoms),
    nAtoms: atoms.length,
    nGhostAtoms: 0,
    finalEnergyEh: energy,
    frames:
      atoms.length > 0
        ? [{ index: 0, label: 'Geometry + Gradients', atoms, energy, line: 0 }]
        : [],
    optCycles: [],
    scfSteps: [],
    orbitals: [],
    mullikenCharges: [],
    loewdinCharges: [],
    hirshfeldCharges: [],
    frequencies: [],
    imaginaryCount: 0,
    excitedStates: [],
    errors: [],
    warnings: [],
    outline
  };
}
