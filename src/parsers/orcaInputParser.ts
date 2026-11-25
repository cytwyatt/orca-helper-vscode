import * as fs from 'fs';
import * as path from 'path';
import { computeFormula, lookupElement } from '../data/elements';
import { ORCA6_DEPRECATED_KEYWORDS } from '../data/orca6Keywords';
import { Atom, GeometryFrame, OutlineSection, ParsedOrcaData } from './types';
import { parseXyzContent } from './xyzParser';

export interface InputDiagnosticItem {
  line: number;
  startCol: number;
  endCol: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code: string;
}

export interface ParsedInputBlock {
  name: string;
  startLine: number;
  endLine: number;
  isSingleLine: boolean;
}

export interface ParsedOrcaInputResult {
  data: ParsedOrcaData;
  diagnostics: InputDiagnosticItem[];
  blocks: ParsedInputBlock[];
  coordLineToAtomIndex: Map<number, Atom>;
}

const SINGLE_LINE_BLOCKS = new Set(['maxcore', 'moinp', 'base', 'id']);
const SUBBLOCK_OPENERS = new Set([
  'constraints',
  'scan',
  'modify_internal',
  'hybrid_hess',
  'ts_mode',
  'newgto',
  'newecp',
  'newauxjgto',
  'newauxcgto',
  'newauxjkgto',
  'newcabsgto',
  'frag',
  'shift',
  'gto',
  'ecp',
  'plot',
  'mo',
  'cube',
  'traj'
]);

function stripComment(line: string): string {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (ch === '#' && !inQuotes) {
      return line.slice(0, i);
    }
  }
  return line;
}

export function parseOrcaInput(
  content: string,
  filePath: string,
  shortContactThreshold = 0.5
): ParsedOrcaInputResult {
  const lines = content.split(/\r?\n/);
  const diagnostics: InputDiagnosticItem[] = [];
  const blocks: ParsedInputBlock[] = [];
  const outline: OutlineSection[] = [];
  const simpleKeywords: string[] = [];
  const frames: GeometryFrame[] = [];
  const coordLineToAtomIndex = new Map<number, Atom>();

  let currentJobIndex = 0;
  let inCoordBlock = false;
  let coordBlockStartLine = -1;
  let coordType = 'xyz';
  let currentCharge: number | undefined;
  let currentMult: number | undefined;
  let currentAtoms: Atom[] = [];

  // Block nesting stack: tracks open %block and sub-blocks expecting `end`
  const blockStack: { name: string; line: number; isTopLevel: boolean }[] = [];

  const finalizeCoordCheck = (endLine: number) => {
    if (currentCharge !== undefined && currentMult !== undefined) {
      if (currentMult < 1) {
        diagnostics.push({
          line: coordBlockStartLine,
          startCol: 0,
          endCol: lines[coordBlockStartLine]?.length ?? 1,
          severity: 'error',
          message: `Spin multiplicity must be >= 1 (found ${currentMult}).`,
          code: 'invalid-multiplicity'
        });
      }
      if (currentAtoms.length > 0) {
        let totalZ = 0;
        let allKnown = true;
        for (const a of currentAtoms) {
          if (a.isGhost) {
            continue;
          }
          const info = lookupElement(a.element);
          if (!info) {
            allKnown = false;
          } else {
            totalZ += info.z;
          }
        }
        if (allKnown && totalZ > 0) {
          const nElectrons = totalZ - currentCharge;
          if (nElectrons < 0) {
            diagnostics.push({
              line: coordBlockStartLine,
              startCol: 0,
              endCol: lines[coordBlockStartLine]?.length ?? 1,
              severity: 'error',
              message: `Total electron count is negative (${nElectrons}) for charge ${currentCharge}.`,
              code: 'negative-electrons'
            });
          } else if ((nElectrons + currentMult - 1) % 2 !== 0) {
            diagnostics.push({
              line: coordBlockStartLine,
              startCol: 0,
              endCol: lines[coordBlockStartLine]?.length ?? 1,
              severity: 'error',
              message: `Electron count / spin multiplicity parity mismatch: ${nElectrons} electrons (charge ${currentCharge}) cannot have multiplicity ${currentMult}.`,
              code: 'spin-parity-mismatch'
            });
          }
        }

        // Check overlapping / short contacts (skip if very large system > 400 atoms for speed)
        if (currentAtoms.length <= 400 && shortContactThreshold > 0) {
          const thresh2 = shortContactThreshold * shortContactThreshold;
          let warned = 0;
          for (let a = 0; a < currentAtoms.length && warned < 10; a++) {
            for (let b = a + 1; b < currentAtoms.length && warned < 10; b++) {
              const A = currentAtoms[a];
              const B = currentAtoms[b];
              const dx = A.x - B.x;
              const dy = A.y - B.y;
              const dz = A.z - B.z;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 < thresh2) {
                const dist = Math.sqrt(d2);
                diagnostics.push({
                  line: B.line ?? coordBlockStartLine,
                  startCol: 0,
                  endCol: lines[B.line ?? coordBlockStartLine]?.length ?? 1,
                  severity: 'warning',
                  message: `Very short distance (${dist.toFixed(3)} Å) between atom ${A.index} (${A.element}) and atom ${B.index} (${B.element}).`,
                  code: 'short-contact'
                });
                warned++;
              }
            }
          }
        }

        const formula = computeFormula(currentAtoms);
        frames.push({
          index: frames.length,
          label:
            currentJobIndex === 0
              ? `Input Geometry (${formula})`
              : `Job ${currentJobIndex + 1} Input (${formula})`,
          atoms: currentAtoms,
          line: coordBlockStartLine,
          comment: `Charge ${currentCharge}, Mult ${currentMult}`
        });
        outline.push({
          label: `* ${coordType} ${currentCharge} ${currentMult}`,
          detail: `${formula} (${currentAtoms.length} atoms)`,
          line: coordBlockStartLine,
          category: 'coords'
        });
      }
    }
    void endLine;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const clean = stripComment(rawLine).trim();
    if (!clean) {
      continue;
    }

    // Handle coordinate block body
    if (inCoordBlock) {
      if (/^\*\s*$/.test(clean) || /^end\b/i.test(clean)) {
        inCoordBlock = false;
        finalizeCoordCheck(i);
        continue;
      }

      if (coordType === 'xyz') {
        // Format: Element [:] [(frag)] x y z [optional NewGTO ... end]
        const m = clean.match(
          /^([A-Za-z]{1,2}|\d+)\s*(:)?(?:\((\d+)\))?\s+([+-]?\d+(?:\.\d*)?(?:[eEdD][+-]?\d+)?)\s+([+-]?\d+(?:\.\d*)?(?:[eEdD][+-]?\d+)?)\s+([+-]?\d+(?:\.\d*)?(?:[eEdD][+-]?\d+)?)(?:\s+(.*))?$/
        );
        if (!m) {
          diagnostics.push({
            line: i,
            startCol: 0,
            endCol: rawLine.length,
            severity: 'error',
            message: 'Invalid Cartesian coordinate line. Expected: <Element> [:] <x> <y> <z>',
            code: 'invalid-coord-line'
          });
          continue;
        }
        const elRaw = m[1];
        const elInfo = lookupElement(elRaw);
        if (!elInfo) {
          const idx = rawLine.indexOf(elRaw);
          diagnostics.push({
            line: i,
            startCol: Math.max(0, idx),
            endCol: Math.max(0, idx) + elRaw.length,
            severity: 'error',
            message: `Unknown chemical element "${elRaw}".`,
            code: 'unknown-element'
          });
        }
        const atom: Atom = {
          index: currentAtoms.length,
          element: elInfo?.symbol ?? elRaw,
          isGhost: Boolean(m[2]),
          fragment: m[3] ? parseInt(m[3], 10) : undefined,
          x: parseFloat(m[4].replace(/[dD]/, 'e')),
          y: parseFloat(m[5].replace(/[dD]/, 'e')),
          z: parseFloat(m[6].replace(/[dD]/, 'e')),
          line: i
        };
        currentAtoms.push(atom);
        coordLineToAtomIndex.set(i, atom);
      }
      continue;
    }

    // $new_job directive
    if (/^\$new_job\b/i.test(clean)) {
      // Any unclosed block before $new_job is an error
      while (blockStack.length > 0) {
        const unclosed = blockStack.pop()!;
        diagnostics.push({
          line: unclosed.line,
          startCol: 0,
          endCol: lines[unclosed.line]?.length ?? 1,
          severity: 'error',
          message: `Unclosed block "${unclosed.name}" before $new_job (missing "end").`,
          code: 'unclosed-block'
        });
      }
      currentJobIndex++;
      outline.push({
        label: `$new_job (Job ${currentJobIndex + 1})`,
        line: i,
        category: 'job'
      });
      continue;
    }

    // Simple input line: ! ...
    if (clean.startsWith('!')) {
      const rest = clean.slice(1).trim();
      const tokens = rest.split(/\s+/).filter(Boolean);
      simpleKeywords.push(...tokens);
      outline.push({
        label: `! ${rest.length > 52 ? rest.slice(0, 49) + '...' : rest}`,
        line: i,
        category: 'header'
      });

      // Check for deprecated ORCA 4 keywords
      let searchPos = rawLine.indexOf('!') + 1;
      for (const tok of tokens) {
        const pos = rawLine.indexOf(tok, searchPos);
        searchPos = pos >= 0 ? pos + tok.length : searchPos;
        const lower = tok.toLowerCase();
        if (ORCA6_DEPRECATED_KEYWORDS[lower]) {
          diagnostics.push({
            line: i,
            startCol: Math.max(0, pos),
            endCol: Math.max(0, pos) + tok.length,
            severity: 'warning',
            message: `ORCA 6 notice for "${tok}": ${ORCA6_DEPRECATED_KEYWORDS[lower]}`,
            code: 'deprecated-orca6-keyword'
          });
        }
      }
      continue;
    }

    // Coordinate block start: * xyz / * xyzfile / * int / * gzmt
    if (clean.startsWith('*')) {
      const xyzfileMatch = clean.match(
        /^\*\s*(xyzfile|gzmtfile|intfile)\s+([+-]?\d+)\s+(\d+)\s+(\S+)/i
      );
      if (xyzfileMatch) {
        const kind = xyzfileMatch[1].toLowerCase();
        const chg = parseInt(xyzfileMatch[2], 10);
        const mult = parseInt(xyzfileMatch[3], 10);
        const relFile = xyzfileMatch[4].replace(/^"|"$/g, '');
        currentCharge = chg;
        currentMult = mult;
        coordType = kind;
        coordBlockStartLine = i;

        const resolved = path.isAbsolute(relFile)
          ? relFile
          : path.resolve(path.dirname(filePath), relFile);
        if (fs.existsSync(resolved)) {
          if (kind === 'xyzfile') {
            try {
              const xyzText = fs.readFileSync(resolved, 'utf8');
              const parsedXyz = parseXyzContent(xyzText, resolved);
              if (parsedXyz.frames.length > 0) {
                currentAtoms = parsedXyz.frames[0].atoms;
                finalizeCoordCheck(i);
              }
            } catch {
              // ignore read error
            }
          } else {
            outline.push({
              label: `* ${kind} ${chg} ${mult} ${relFile}`,
              line: i,
              category: 'coords'
            });
          }
        } else {
          const idx = rawLine.indexOf(xyzfileMatch[4]);
          diagnostics.push({
            line: i,
            startCol: Math.max(0, idx),
            endCol: Math.max(0, idx) + xyzfileMatch[4].length,
            severity: 'warning',
            message: `Referenced coordinate file not found: "${relFile}" (resolved: ${resolved}).`,
            code: 'missing-xyzfile'
          });
          outline.push({
            label: `* ${kind} ${chg} ${mult} ${relFile}`,
            detail: 'file not found',
            line: i,
            category: 'coords'
          });
        }
        continue;
      }

      const inlineCoordMatch = clean.match(/^\*\s*(xyz|int|internal|gzmt)\s+([+-]?\d+)\s+(\d+)/i);
      if (inlineCoordMatch) {
        inCoordBlock = true;
        coordBlockStartLine = i;
        coordType = inlineCoordMatch[1].toLowerCase();
        currentCharge = parseInt(inlineCoordMatch[2], 10);
        currentMult = parseInt(inlineCoordMatch[3], 10);
        currentAtoms = [];
        continue;
      }
    }

    // %block handling
    if (clean.startsWith('%')) {
      const m = clean.match(/^%([A-Za-z_][A-Za-z0-9_]*)\b(.*)$/);
      if (m) {
        const blockName = m[1];
        const lowerName = blockName.toLowerCase();
        const rest = m[2].trim();

        if (SINGLE_LINE_BLOCKS.has(lowerName)) {
          blocks.push({ name: lowerName, startLine: i, endLine: i, isSingleLine: true });
          outline.push({
            label: `%${blockName} ${rest}`.trim(),
            line: i,
            category: 'block'
          });
          if (lowerName === 'maxcore') {
            const val = parseFloat(rest);
            if (isNaN(val) || val <= 0) {
              diagnostics.push({
                line: i,
                startCol: 0,
                endCol: rawLine.length,
                severity: 'error',
                message: `%maxcore expects a positive memory size in MB (e.g. "%maxcore 4000").`,
                code: 'invalid-maxcore'
              });
            } else if (val < 256) {
              diagnostics.push({
                line: i,
                startCol: 0,
                endCol: rawLine.length,
                severity: 'warning',
                message: `%maxcore ${val} MB is very low for ORCA 6 (usually 2000–8000 MB per core).`,
                code: 'low-maxcore'
              });
            }
          }
          continue;
        }

        // Check inline block like "%pal nprocs 32 end"
        const endTokens = rest.match(/\bend\b/gi);
        if (endTokens && endTokens.length > 0) {
          blocks.push({ name: lowerName, startLine: i, endLine: i, isSingleLine: true });
          outline.push({
            label: `%${blockName}`,
            detail: rest.replace(/\bend\b/gi, '').trim(),
            line: i,
            category: 'block'
          });
          continue;
        }

        // Multi-line block start
        blockStack.push({ name: `%${blockName}`, line: i, isTopLevel: true });
        outline.push({
          label: `%${blockName}`,
          line: i,
          category: 'block'
        });
        continue;
      }
    }

    // Inside a %block: track nested sub-blocks and `end`
    if (blockStack.length > 0) {
      const firstWord = clean.split(/\s+/)[0].toLowerCase();
      const hasEndOnLine = /\bend\b/i.test(clean);

      if (firstWord === 'end') {
        const closed = blockStack.pop()!;
        if (closed.isTopLevel) {
          blocks.push({
            name: closed.name.slice(1).toLowerCase(),
            startLine: closed.line,
            endLine: i,
            isSingleLine: false
          });
        }
        continue;
      }

      if (SUBBLOCK_OPENERS.has(firstWord)) {
        // Inline sub-block e.g. `NewGTO I "aug-cc-pVDZ-PP" end` opens and closes on same line
        if (!hasEndOnLine) {
          blockStack.push({ name: firstWord, line: i, isTopLevel: false });
        }
        continue;
      }

      // Some sub-blocks close at end of line e.g. `... end`
      if (hasEndOnLine && /\s+end\s*$/i.test(clean)) {
        // Only pop if it wasn't an inline subblock opener
        const closed = blockStack.pop()!;
        if (closed.isTopLevel) {
          blocks.push({
            name: closed.name.slice(1).toLowerCase(),
            startLine: closed.line,
            endLine: i,
            isSingleLine: false
          });
        }
      }
    } else if (/^end\b/i.test(clean)) {
      diagnostics.push({
        line: i,
        startCol: 0,
        endCol: rawLine.length,
        severity: 'error',
        message: 'Unexpected "end" with no matching open %block.',
        code: 'stray-end'
      });
    }
  }

  // Unclosed coordinate block
  if (inCoordBlock) {
    diagnostics.push({
      line: coordBlockStartLine,
      startCol: 0,
      endCol: lines[coordBlockStartLine]?.length ?? 1,
      severity: 'error',
      message: 'Unclosed coordinate block (missing closing "*").',
      code: 'unclosed-coord-block'
    });
    finalizeCoordCheck(lines.length - 1);
  }

  // Unclosed %blocks
  while (blockStack.length > 0) {
    const unclosed = blockStack.pop()!;
    diagnostics.push({
      line: unclosed.line,
      startCol: 0,
      endCol: lines[unclosed.line]?.length ?? 1,
      severity: 'error',
      message: `Unclosed block "${unclosed.name}" (missing "end").`,
      code: 'unclosed-block'
    });
  }

  const primaryAtoms = frames.length > 0 ? frames[frames.length - 1].atoms : [];
  const data: ParsedOrcaData = {
    filePath,
    fileName: path.basename(filePath),
    fileType: 'orca-input',
    status: diagnostics.some((d) => d.severity === 'error') ? 'error' : 'input',
    formula: computeFormula(primaryAtoms),
    nAtoms: primaryAtoms.length,
    nGhostAtoms: primaryAtoms.filter((a) => a.isGhost).length,
    charge: currentCharge,
    multiplicity: currentMult,
    simpleInputKeywords: simpleKeywords,
    frames,
    optCycles: [],
    scfSteps: [],
    orbitals: [],
    mullikenCharges: [],
    loewdinCharges: [],
    hirshfeldCharges: [],
    frequencies: [],
    imaginaryCount: 0,
    excitedStates: [],
    errors: diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => ({ line: d.line, message: d.message })),
    warnings: diagnostics
      .filter((d) => d.severity === 'warning')
      .map((d) => ({ line: d.line, message: d.message })),
    outline
  };

  return { data, diagnostics, blocks, coordLineToAtomIndex };
}
