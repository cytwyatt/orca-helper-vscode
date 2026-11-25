import * as vscode from 'vscode';
import { parseOrcaInput } from '../parsers/orcaInputParser';

export class OrcaDiagnosticsManager {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('orca6');
  }

  public validateDocument(document: vscode.TextDocument): void {
    if (document.languageId !== 'orca-input' && !document.fileName.toLowerCase().endsWith('.inp')) {
      return;
    }
    const config = vscode.workspace.getConfiguration('orcaHelper');
    const shortContactThreshold = config.get<number>('shortContactThreshold', 0.5);

    const parsed = parseOrcaInput(document.getText(), document.uri.fsPath, shortContactThreshold);
    const vsDiagnostics = parsed.diagnostics.map((d) => {
      const lineIdx = Math.min(Math.max(0, d.line), Math.max(0, document.lineCount - 1));
      const lineLen = document.lineAt(lineIdx).text.length;
      const range = new vscode.Range(
        lineIdx,
        Math.min(d.startCol, lineLen),
        lineIdx,
        Math.min(Math.max(d.endCol, d.startCol + 1), Math.max(1, lineLen))
      );
      const severity =
        d.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : d.severity === 'warning'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;
      const diag = new vscode.Diagnostic(range, d.message, severity);
      diag.source = 'ORCA 6 Helper';
      diag.code = d.code;
      return diag;
    });

    this.collection.set(document.uri, vsDiagnostics);
  }

  public clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  public dispose(): void {
    this.collection.dispose();
  }
}
