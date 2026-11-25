import * as path from 'path';
import { parseEngradContent, parseHessContent } from './hessEngradParser';
import { parseOrcaInput } from './orcaInputParser';
import { isOrcaOutputContent, parseOrcaOutput } from './orcaOutputParser';
import { ParsedOrcaData } from './types';
import { parseXyzContent } from './xyzParser';

export * from './types';
export { parseOrcaInput } from './orcaInputParser';
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
    return parseOrcaInput(content, filePath, shortContactThreshold).data;
  }
  if (ext === '.xyz') {
    return parseXyzContent(content, filePath);
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
