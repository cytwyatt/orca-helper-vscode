import * as vscode from 'vscode';
import { OutlineSection, parseAnyOrcaFile } from '../parsers';

function mapSymbolKind(category: OutlineSection['category']): vscode.SymbolKind {
  switch (category) {
    case 'header':
    case 'job':
      return vscode.SymbolKind.Module;
    case 'block':
      return vscode.SymbolKind.Namespace;
    case 'coords':
      return vscode.SymbolKind.Struct;
    case 'cycle':
      return vscode.SymbolKind.Method;
    case 'energy':
    case 'thermo':
      return vscode.SymbolKind.Constant;
    case 'converged':
      return vscode.SymbolKind.Event;
    case 'freq':
    case 'spectrum':
      return vscode.SymbolKind.Function;
    case 'orbitals':
    case 'charges':
    case 'dipole':
      return vscode.SymbolKind.Property;
    case 'error':
    case 'warning':
      return vscode.SymbolKind.Interface;
    default:
      return vscode.SymbolKind.Key;
  }
}

function toDocumentSymbol(
  section: OutlineSection,
  document: vscode.TextDocument
): vscode.DocumentSymbol {
  const line = Math.min(Math.max(0, section.line), Math.max(0, document.lineCount - 1));
  const lineRange = document.lineAt(line).range;
  const sym = new vscode.DocumentSymbol(
    section.label,
    section.detail ?? '',
    mapSymbolKind(section.category),
    lineRange,
    lineRange
  );
  if (section.children && section.children.length > 0) {
    sym.children = section.children.map((c) => toDocumentSymbol(c, document));
  }
  return sym;
}

export class OrcaDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const parsed = parseAnyOrcaFile(document.getText(), document.uri.fsPath);
    if (!parsed) {
      return [];
    }
    return parsed.outline.map((sec) => toDocumentSymbol(sec, document));
  }
}
