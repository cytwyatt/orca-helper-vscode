import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  isOrcaInputContent,
  isOrcaOutputContent,
  parseAnyOrcaFile,
  ParsedOrcaData
} from './parsers';
import { OrcaCompletionProvider } from './providers/completionProvider';
import { OrcaDiagnosticsManager } from './providers/diagnosticsProvider';
import { OrcaHoverProvider } from './providers/hoverProvider';
import { OrcaDocumentSymbolProvider } from './providers/symbolProvider';
import { enrichParsedWithSiblingHess, findRelatedOrcaFiles } from './utils/relatedFiles';
import {
  OrcaOutlineProvider,
  OrcaSummaryProvider,
  OrcaWorkspaceFilesProvider
} from './views/sidebarViews';
import { OrcaViewerPanel } from './webview/viewerPanel';

const SUPPORTED_EXTENSIONS = new Set([
  '.inp',
  '.out',
  '.orcaout',
  '.xyz',
  '.trj',
  '.allxyz',
  '.hess',
  '.engrad',
  '.log'
]);

const TEMPLATES: Record<string, string> = {
  'Opt + Freq (DFT: B3LYP-D3BJ/def2-TZVPP)': `%pal nprocs 16 end
%maxcore 4000

! B3LYP D3BJ def2-TZVPP TightOpt TightSCF DEFGRID3 Freq

* xyz 0 1
# Paste coordinates here
*
`,
  'Fast Opt + Freq (r2SCAN-3c)': `%pal nprocs 16 end
%maxcore 4000

! r2SCAN-3c TightOpt Freq

* xyz 0 1
# Paste coordinates here
*
`,
  'High-Level Single Point (DLPNO-CCSD(T)/def2-QZVPP)': `%pal nprocs 16 end
%maxcore 6000

! DLPNO-CCSD(T) def2-QZVPP def2-QZVPP/C TightPNO TightSCF SP

%scf
  MaxIter 300
end

* xyz 0 1
# Paste coordinates here
*
`,
  'TD-DFT Excited States (UV-Vis)': `%pal nprocs 16 end
%maxcore 4000

! CAM-B3LYP def2-TZVP TightSCF CPCM(Water)

%tddft
  NRoots 15
  TDA false
  Triplets false
end

* xyzfile 0 1 geometry.xyz
`,
  'Transition State Search (OptTS + Freq)': `%pal nprocs 16 end
%maxcore 4000

! wB97X-D4 def2-TZVP OptTS Freq TightSCF

%geom
  Calc_Hess true
  Recalc_Hess 10
  MaxIter 150
end

* xyz 0 1
# Paste TS guess coordinates here
*
`,
  'GOAT Conformational Search (ORCA 6)': `%pal nprocs 16 end
%maxcore 2000

! XTB2 GOAT ALPB(Water)

%goat
  MaxOptIter 500
end

* xyzfile 0 1 input.xyz
`
};

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = new OrcaDiagnosticsManager();
  const outlineProvider = new OrcaOutlineProvider();
  const summaryProvider = new OrcaSummaryProvider();
  const workspaceProvider = new OrcaWorkspaceFilesProvider();

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'orcaHelper.openViewer';
  context.subscriptions.push(statusBarItem, diagnostics);

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('orcaHelper.outlineView', outlineProvider),
    vscode.window.registerTreeDataProvider('orcaHelper.summaryView', summaryProvider),
    vscode.window.registerTreeDataProvider('orcaHelper.workspaceView', workspaceProvider)
  );

  // Register ORCA 6 input language intelligence
  const inpSelector: vscode.DocumentSelector = [
    { language: 'orca-input', scheme: 'file' },
    { language: 'orca-input', scheme: 'untitled' }
  ];
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      inpSelector,
      new OrcaCompletionProvider(),
      '!',
      '%',
      '*',
      '(',
      ' '
    ),
    vscode.languages.registerHoverProvider(inpSelector, new OrcaHoverProvider())
  );

  // Register DocumentSymbolProvider for all supported ORCA formats
  const allSymbolSelector: vscode.DocumentSelector = [
    { language: 'orca-input' },
    { language: 'orca-output' },
    { language: 'orca-xyz' },
    { language: 'orca-hess' },
    { language: 'orca-engrad' }
  ];
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      allSymbolSelector,
      new OrcaDocumentSymbolProvider()
    )
  );

  // Parse cache to avoid re-parsing huge .out on every cursor move
  const parseCache = new Map<string, { version: number; data?: ParsedOrcaData }>();

  function getParsedForDocument(doc: vscode.TextDocument): ParsedOrcaData | undefined {
    const key = doc.uri.toString();
    const cached = parseCache.get(key);
    if (cached && cached.version === doc.version) {
      return cached.data;
    }
    const ext = path.extname(doc.fileName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext) && doc.languageId !== 'orca-input') {
      return undefined;
    }
    const cfg = vscode.workspace.getConfiguration('orcaHelper');
    const shortContact = cfg.get<number>('shortContactThreshold', 0.5);
    const data = parseAnyOrcaFile(doc.getText(), doc.uri.fsPath, shortContact);
    parseCache.set(key, { version: doc.version, data });
    return data;
  }

  async function maybeAutoDetectOrcaLanguage(doc: vscode.TextDocument): Promise<void> {
    const ext = path.extname(doc.fileName).toLowerCase();
    const cfg = vscode.workspace.getConfiguration('orcaHelper');

    // Auto-apply orca-input when another extension (e.g. Packmol in gmx_helper) claims .inp
    if (
      ext === '.inp' &&
      doc.languageId !== 'orca-input' &&
      cfg.get<boolean>('autoDetectInputLanguage', true)
    ) {
      const head = doc.getText(
        new vscode.Range(0, 0, Math.min(200, doc.lineCount), 0)
      );
      if (isOrcaInputContent(head)) {
        try {
          await vscode.languages.setTextDocumentLanguage(doc, 'orca-input');
        } catch {
          // ignore if language switch fails
        }
      }
      return;
    }

    // Auto-apply orca-output syntax highlighting if .out/.log is genuinely an ORCA output
    if (
      (ext === '.out' || ext === '.log') &&
      doc.languageId !== 'orca-output' &&
      cfg.get<boolean>('autoDetectOutputLanguage', true)
    ) {
      const head = doc.getText(
        new vscode.Range(0, 0, Math.min(120, doc.lineCount), 0)
      );
      if (isOrcaOutputContent(head)) {
        try {
          await vscode.languages.setTextDocumentLanguage(doc, 'orca-output');
        } catch {
          // ignore if language switch fails
        }
      }
    }
  }

  async function inspectActiveDocument(doc?: vscode.TextDocument): Promise<void> {
    if (!doc) {
      await vscode.commands.executeCommand('setContext', 'orcaHelper.isSupportedFile', false);
      statusBarItem.hide();
      outlineProvider.update(undefined);
      summaryProvider.update(undefined);
      return;
    }

    await maybeAutoDetectOrcaLanguage(doc);

    const ext = path.extname(doc.fileName).toLowerCase();
    if (doc.languageId === 'orca-input' || ext === '.inp') {
      diagnostics.validateDocument(doc);
    }

    const parsed = getParsedForDocument(doc);
    const isSupported = Boolean(parsed);
    await vscode.commands.executeCommand('setContext', 'orcaHelper.isSupportedFile', isSupported);

    outlineProvider.update(parsed);
    summaryProvider.update(parsed);

    if (parsed) {
      const parts = [`$(beaker) ORCA 6: ${parsed.formula}`];
      if (parsed.finalEnergyEh !== undefined) {
        parts.push(`${parsed.finalEnergyEh.toFixed(6)} Eh`);
      }
      if (parsed.optCycles.length > 0) {
        parts.push(
          parsed.optConverged ? `${parsed.optCycles.length} cyc ✓` : `${parsed.optCycles.length} cyc`
        );
      } else if (parsed.frames.length > 1) {
        parts.push(`${parsed.frames.length} frames`);
      }
      if (parsed.imaginaryCount > 0) {
        parts.push(`$(warning) ${parsed.imaginaryCount} imag`);
      }
      statusBarItem.text = parts.join(' | ');
      statusBarItem.tooltip = 'Click to open ORCA 6 3D Structure & Analysis Viewer';
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }

  // Commands
  async function openViewerForUri(uri?: vscode.Uri): Promise<void> {
    let targetPath: string | undefined;
    let text: string | undefined;

    if (uri) {
      targetPath = uri.fsPath;
      const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === targetPath);
      if (openDoc) {
        text = openDoc.getText();
      } else if (fs.existsSync(targetPath)) {
        text = fs.readFileSync(targetPath, 'utf8');
      }
    } else if (vscode.window.activeTextEditor) {
      const doc = vscode.window.activeTextEditor.document;
      targetPath = doc.uri.fsPath;
      text = doc.getText();
    }

    if (!targetPath || text === undefined) {
      vscode.window.showWarningMessage(
        'Open an ORCA file (.inp, .out, _trj.xyz, .trj, .allxyz, .hess, .engrad) first.'
      );
      return;
    }

    const cfg = vscode.workspace.getConfiguration('orcaHelper');
    const rawParsed = parseAnyOrcaFile(
      text,
      targetPath,
      cfg.get<number>('shortContactThreshold', 0.5)
    );
    if (!rawParsed) {
      vscode.window.showWarningMessage(
        `"${path.basename(targetPath)}" does not appear to be a recognized ORCA 6 file.`
      );
      return;
    }

    const parsed = enrichParsedWithSiblingHess(rawParsed);
    outlineProvider.update(parsed);
    summaryProvider.update(parsed);
    OrcaViewerPanel.createOrShow(context.extensionUri, parsed);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('orcaHelper.openViewer', () => openViewerForUri()),
    vscode.commands.registerCommand('orcaHelper.openViewerFromExplorer', (uri: vscode.Uri) =>
      openViewerForUri(uri)
    ),
    vscode.commands.registerCommand('orcaHelper.refreshOutline', () => {
      parseCache.clear();
      void inspectActiveDocument(vscode.window.activeTextEditor?.document);
    }),
    vscode.commands.registerCommand('orcaHelper.refreshWorkspace', () => {
      workspaceProvider.refresh();
    }),
    vscode.commands.registerCommand('orcaHelper.validateInput', () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (!doc) {
        return;
      }
      diagnostics.validateDocument(doc);
      vscode.window.showInformationMessage('ORCA 6 input validation completed.');
    }),
    vscode.commands.registerCommand('orcaHelper.jumpToLine', (line: number) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const safeLine = Math.min(Math.max(0, line), Math.max(0, editor.document.lineCount - 1));
      const pos = new vscode.Position(safeLine, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }),
    vscode.commands.registerCommand('orcaHelper.insertTemplate', async () => {
      const pick = await vscode.window.showQuickPick(Object.keys(TEMPLATES), {
        placeHolder: 'Select an ORCA 6 input template to insert'
      });
      if (!pick) {
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit((eb) => eb.insert(editor.selection.active, TEMPLATES[pick]));
      } else {
        const doc = await vscode.workspace.openTextDocument({
          language: 'orca-input',
          content: TEMPLATES[pick]
        });
        await vscode.window.showTextDocument(doc);
      }
    }),
    vscode.commands.registerCommand('orcaHelper.openRelatedFile', async () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (!doc) {
        return;
      }
      const related = findRelatedOrcaFiles(doc.uri.fsPath);
      if (related.length === 0) {
        vscode.window.showInformationMessage(
          `No sibling ORCA files found for "${path.basename(doc.uri.fsPath)}".`
        );
        return;
      }

      const pick = await vscode.window.showQuickPick(
        related.map((r) => ({
          label: r.fileName,
          description: r.tag,
          detail: r.filePath,
          fullPath: r.filePath
        })),
        { placeHolder: `Switch to related file for ${path.basename(doc.uri.fsPath)}` }
      );
      if (pick) {
        const opened = await vscode.workspace.openTextDocument(vscode.Uri.file(pick.fullPath));
        await vscode.window.showTextDocument(opened);
      }
    }),
    vscode.commands.registerCommand('orcaHelper.copyGeometryAsOrca', async () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (!doc) {
        return;
      }
      const parsed = getParsedForDocument(doc);
      if (!parsed || parsed.frames.length === 0) {
        vscode.window.showWarningMessage('No molecular geometry found in active file.');
        return;
      }
      const frame = parsed.frames[parsed.frames.length - 1];
      const chg = parsed.charge ?? 0;
      const mult = parsed.multiplicity ?? 1;
      const lines = [`* xyz ${chg} ${mult}`];
      for (const a of frame.atoms) {
        const tag = a.isGhost ? `${a.element} :` : a.element;
        lines.push(
          `  ${tag.padEnd(4)} ${a.x.toFixed(8).padStart(14)} ${a.y.toFixed(8).padStart(14)} ${a.z.toFixed(8).padStart(14)}`
        );
      }
      lines.push('*');
      await vscode.env.clipboard.writeText(lines.join('\n'));
      vscode.window.showInformationMessage(
        `Copied final geometry (${frame.atoms.length} atoms) as ORCA * xyz block.`
      );
    })
  );

  // Event listeners
  let changeTimer: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      void inspectActiveDocument(editor?.document);
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      void maybeAutoDetectOrcaLanguage(doc).then(() => {
        if (doc.languageId === 'orca-input' || doc.fileName.toLowerCase().endsWith('.inp')) {
          diagnostics.validateDocument(doc);
        }
      });
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (
        e.document.languageId === 'orca-input' ||
        e.document.fileName.toLowerCase().endsWith('.inp')
      ) {
        if (changeTimer) {
          clearTimeout(changeTimer);
        }
        changeTimer = setTimeout(() => {
          void maybeAutoDetectOrcaLanguage(e.document).then(() => {
            diagnostics.validateDocument(e.document);
            if (vscode.window.activeTextEditor?.document === e.document) {
              parseCache.delete(e.document.uri.toString());
              const parsed = getParsedForDocument(e.document);
              outlineProvider.update(parsed);
              summaryProvider.update(parsed);
              if (parsed) {
                OrcaViewerPanel.updateIfOpen(enrichParsedWithSiblingHess(parsed));
              }
            }
          });
        }, 350);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      parseCache.delete(doc.uri.toString());
      const parsed = getParsedForDocument(doc);
      if (parsed) {
        const enriched = enrichParsedWithSiblingHess(parsed);
        OrcaViewerPanel.updateIfOpen(enriched);
        if (vscode.window.activeTextEditor?.document === doc) {
          outlineProvider.update(enriched);
          summaryProvider.update(enriched);
        }
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      parseCache.delete(doc.uri.toString());
      diagnostics.clear(doc.uri);
    })
  );

  // Initial inspect
  for (const doc of vscode.workspace.textDocuments) {
    void maybeAutoDetectOrcaLanguage(doc).then(() => {
      if (doc.languageId === 'orca-input' || doc.fileName.toLowerCase().endsWith('.inp')) {
        diagnostics.validateDocument(doc);
      }
    });
  }
  if (vscode.window.activeTextEditor) {
    void inspectActiveDocument(vscode.window.activeTextEditor.document);
  }
}

export function deactivate(): void {
  // cleanup handled via context.subscriptions
}
