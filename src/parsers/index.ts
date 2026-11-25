import * as path from 'path';
import { parseEngradContent, parseHessContent } from './hessEngradParser';
import { isOrcaInputContent, parseOrcaInput } from './orcaInputParser';
import { isOrcaOutputContent, parseOrcaOutput } from './orcaOutputParser';
import { ParsedOrcaData } from './types';
import { parseXyzContent } from './xyzParser';

export * from './types';
export { isOrcaInputContent, parseOrcaInput } from './orcaInputParser';
export { isOrcaOutputContent, parseOrcaOutput } from './orcaOutputParser';
export { parseXyzContent } from './xyzParser';
export { parseHessContent, parseEngradContent } from './hessEngradParser';

export function parseAnyOrcaFile(
  content: string,
  filePath: string,
  shortContactThreshold = 0.5
): ParsedOrcaData | undefined {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.inp') {
    if (!isOrcaInputContent(content)) {
      return undefined;
    }
    return parseOrcaInput(content, filePath, shortContactThreshold).data;
  }
  if (ext === '.xyz' || ext === '.trj' || ext === '.allxyz') {
    const parsed = parseXyzContent(content, filePath);
    return parsed.frames.length > 0 ? parsed : undefined;
  }
  if (ext === '.hess') {
    return parseHessContent(content, filePath);
  }
  if (ext === '.engrad') {
    return parseEngradContent(content, filePath);
  }
  if (ext === '.out' || ext === '.orcaout' || ext === '.log') {
    const head = content.slice(0, 12000);
    if (isOrcaOutputContent(head)) {
      return parseOrcaOutput(content, filePath);
    }
  }
  return undefined;
}
