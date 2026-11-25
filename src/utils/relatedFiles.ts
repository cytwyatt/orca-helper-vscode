import * as fs from 'fs';
import * as path from 'path';
import { ParsedOrcaData, parseHessContent } from '../parsers';

export interface RelatedOrcaFile {
  filePath: string;
  fileName: string;
  kind: 'traj' | 'hess' | 'out' | 'inp' | 'xyz' | 'engrad' | 'prop';
  tag: string;
}

const KNOWN_MULTI_SUFFIXES = [
  '_mep_all_trj',
  '_mep_trj',
  '_irc_full_trj',
  '_irc_f_trj',
  '_irc_b_trj',
  '_trj',
  '.property'
];

export function getOrcaJobStem(filePath: string): string {
  const ext = path.extname(filePath);
  let base = path.basename(filePath, ext);
  const lower = base.toLowerCase();
  for (const suf of KNOWN_MULTI_SUFFIXES) {
    if (lower.endsWith(suf)) {
      base = base.slice(0, base.length - suf.length);
      break;
    }
  }
  return base;
}

export function findRelatedOrcaFiles(filePath: string): RelatedOrcaFile[] {
  const dir = path.dirname(filePath);
  const stem = getOrcaJobStem(filePath);
  if (!stem || !fs.existsSync(dir)) {
    return [];
  }

  const specs: { suffix: string; kind: RelatedOrcaFile['kind']; tag: string }[] = [
    { suffix: '_trj.xyz', kind: 'traj', tag: 'Trajectory' },
    { suffix: '.allxyz', kind: 'traj', tag: 'Scan Trj' },
    { suffix: '_MEP_trj.xyz', kind: 'traj', tag: 'NEB MEP' },
    { suffix: '_MEP_ALL_trj.xyz', kind: 'traj', tag: 'NEB All' },
    { suffix: '_IRC_Full_trj.xyz', kind: 'traj', tag: 'IRC Trj' },
    { suffix: '.trj', kind: 'traj', tag: 'Trajectory' },
    { suffix: '.hess', kind: 'hess', tag: 'Vibrations' },
    { suffix: '.out', kind: 'out', tag: 'Output' },
    { suffix: '.orcaout', kind: 'out', tag: 'Output' },
    { suffix: '.inp', kind: 'inp', tag: 'Input' },
    { suffix: '.xyz', kind: 'xyz', tag: 'XYZ' },
    { suffix: '.engrad', kind: 'engrad', tag: 'Gradients' },
    { suffix: '.property.txt', kind: 'prop', tag: 'Property' }
  ];

  const resolvedSelf = path.resolve(filePath);
  const results: RelatedOrcaFile[] = [];
  const seen = new Set<string>();

  for (const spec of specs) {
    const candidate = path.join(dir, `${stem}${spec.suffix}`);
    const resolved = path.resolve(candidate);
    if (resolved === resolvedSelf || seen.has(resolved)) {
      continue;
    }
    if (fs.existsSync(candidate)) {
      seen.add(resolved);
      results.push({
        filePath: candidate,
        fileName: path.basename(candidate),
        kind: spec.kind,
        tag: spec.tag
      });
    }
  }

  return results;
}

/**
 * If an ORCA .out file has frequencies without normal-mode displacements
 * (or lacks frequencies altogether) while a sibling .hess file exists with
 * matching atom count, merge vibrational modes/displacements from the .hess.
 */
export function enrichParsedWithSiblingHess(parsed: ParsedOrcaData): ParsedOrcaData {
  if (parsed.fileType !== 'orca-output') {
    return parsed;
  }
  const hasDisplacements = parsed.frequencies.some(
    (m) => m.displacements && m.displacements.length > 0
  );
  if (hasDisplacements) {
    return parsed;
  }

  const dir = path.dirname(parsed.filePath);
  const stem = getOrcaJobStem(parsed.filePath);
  const hessPath = path.join(dir, `${stem}.hess`);
  if (!fs.existsSync(hessPath)) {
    return parsed;
  }

  try {
    const hessData = parseHessContent(fs.readFileSync(hessPath, 'utf8'), hessPath);
    if (hessData.frequencies.length === 0) {
      return parsed;
    }
    if (parsed.nAtoms > 0 && hessData.nAtoms > 0 && hessData.nAtoms !== parsed.nAtoms) {
      return parsed;
    }

    if (parsed.frequencies.length === 0) {
      return {
        ...parsed,
        frequencies: hessData.frequencies,
        imaginaryCount: hessData.imaginaryCount
      };
    }

    const hessByMode = new Map(hessData.frequencies.map((m) => [m.mode, m]));
    const mergedFreqs = parsed.frequencies.map((m) => {
      const hm = hessByMode.get(m.mode);
      if (!hm) {
        return m;
      }
      return {
        ...m,
        displacements: m.displacements ?? hm.displacements,
        irIntensity: m.irIntensity ?? hm.irIntensity,
        eps: m.eps ?? hm.eps,
        tSquared: m.tSquared ?? hm.tSquared
      };
    });
    return {
      ...parsed,
      frequencies: mergedFreqs
    };
  } catch {
    return parsed;
  }
}
