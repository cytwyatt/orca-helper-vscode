import * as path from 'path';
import { computeFormula, lookupElement } from '../data/elements';
import { Atom, GeometryFrame, OutlineSection, ParsedOrcaData } from './types';

export function parseXyzContent(content: string, filePath: string): ParsedOrcaData {
  const lines = content.split(/\r?\n/);
  const frames: GeometryFrame[] = [];
  const outline: OutlineSection[] = [];

  let i = 0;
  while (i < lines.length) {
    // Skip blank lines between frames
    while (i < lines.length && lines[i].trim() === '') {
      i++;
    }
    if (i >= lines.length) {
      break;
    }
    const headerLine = i;
    const countStr = lines[i].trim();
    if (!/^\d+$/.test(countStr)) {
      i++;
      continue;
    }
    const nAtoms = parseInt(countStr, 10);
    if (nAtoms <= 0 || i + 1 + nAtoms >= lines.length) {
      break;
    }
    const comment = (lines[i + 1] ?? '').trim();
    const atoms: Atom[] = [];
    let valid = true;
    for (let k = 0; k < nAtoms; k++) {
      const lineIdx = i + 2 + k;
      const raw = (lines[lineIdx] ?? '').trim();
      const m = raw.match(
        /^([A-Za-z]{1,2}|\d+)\s*(:)?(?:\(\d+\))?\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?)/
      );
      if (!m) {
        valid = false;
        break;
      }
      const elInfo = lookupElement(m[1]);
      const element = elInfo?.symbol ?? m[1];
      const isGhost = Boolean(m[2]);
      const x = parseFloat(m[3].replace(/[dD]/, 'e'));
      const y = parseFloat(m[4].replace(/[dD]/, 'e'));
      const z = parseFloat(m[5].replace(/[dD]/, 'e'));
      atoms.push({ index: k, element, x, y, z, isGhost, line: lineIdx });
    }
    if (valid && atoms.length === nAtoms) {
      // Try extracting energy from ORCA or generic comment line
      // e.g. "Coordinates from ORCA-job water_opt E -76.438912345678"
      let energy: number | undefined;
      const eMatch =
        comment.match(/\bE\s*=?\s*([+-]?\d+\.\d+(?:[eE][+-]?\d+)?)/) ||
        comment.match(/\bEnergy\s*[=:]?\s*([+-]?\d+\.\d+(?:[eE][+-]?\d+)?)/i) ||
        comment.match(/^([+-]?\d+\.\d+(?:[eE][+-]?\d+)?)$/);
      if (eMatch) {
        energy = parseFloat(eMatch[1]);
      }

      const frameIdx = frames.length;
      const label = comment
        ? comment.length > 48
          ? `Frame ${frameIdx + 1}: ${comment.slice(0, 45)}...`
          : `Frame ${frameIdx + 1}: ${comment}`
        : `Frame ${frameIdx + 1}`;

      frames.push({
        index: frameIdx,
        label,
        atoms,
        energy,
        line: headerLine,
        comment
      });

      outline.push({
        label: `Frame ${frameIdx + 1}`,
        detail: energy !== undefined ? `E = ${energy.toFixed(6)} Eh` : comment.slice(0, 40) || `${nAtoms} atoms`,
        line: headerLine,
        category: 'cycle'
      });
    }
    i += 2 + nAtoms;
  }

  const lastAtoms = frames.length > 0 ? frames[frames.length - 1].atoms : [];
  const nGhostAtoms = lastAtoms.filter((a) => a.isGhost).length;
  const lastEnergy = frames.length > 0 ? frames[frames.length - 1].energy : undefined;

  return {
    filePath,
    fileName: path.basename(filePath),
    fileType: 'xyz',
    status: 'structure',
    formula: computeFormula(lastAtoms),
    nAtoms: lastAtoms.length,
    nGhostAtoms,
    finalEnergyEh: lastEnergy,
    frames,
    optCycles: frames
      .filter((f) => f.energy !== undefined)
      .map((f, idx) => ({
        cycle: idx + 1,
        line: f.line ?? 0,
        energy: f.energy,
        criteria: [],
        frameIndex: f.index
      })),
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
