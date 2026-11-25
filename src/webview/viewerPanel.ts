import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GeometryFrame, parseAnyOrcaFile, ParsedOrcaData, VibrationalMode } from '../parsers';
import { enrichParsedWithSiblingHess, findRelatedOrcaFiles } from '../utils/relatedFiles';

export class OrcaViewerPanel {
  private static panels = new Map<string, OrcaViewerPanel>();

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private currentData: ParsedOrcaData;
  private isReady = false;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    data: ParsedOrcaData
  ): OrcaViewerPanel {
    const key = data.filePath;
    const existing = OrcaViewerPanel.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside);
      existing.update(data);
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      'orcaHelperViewer',
      `ORCA 6: ${data.fileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    const instance = new OrcaViewerPanel(panel, extensionUri, data);
    OrcaViewerPanel.panels.set(key, instance);
    return instance;
  }

  public static updateIfOpen(data: ParsedOrcaData): void {
    const existing = OrcaViewerPanel.panels.get(data.filePath);
    if (existing) {
      existing.update(data);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: ParsedOrcaData
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.currentData = data;

    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.type) {
          case 'ready':
            this.isReady = true;
            this.postData();
            break;
          case 'jumpToLine':
            await this.jumpToSourceLine(Number(msg.line));
            break;
          case 'copyOrcaBlock':
            await this.copyOrcaBlock(
              msg.frame as GeometryFrame,
              Number(msg.charge ?? 0),
              Number(msg.multiplicity ?? 1)
            );
            break;
          case 'exportXyz':
            await this.exportFrameXyz(msg.frame as GeometryFrame);
            break;
          case 'exportVibXyz':
            await this.exportVibrationXyz(
              msg.frame as GeometryFrame,
              msg.mode as VibrationalMode,
              Number(msg.amplitude ?? 0.45)
            );
            break;
          case 'loadRelatedFile':
            await this.loadRelatedFile(String(msg.filePath || ''));
            break;
          case 'savePng':
            await this.savePng(String(msg.dataUrl || ''));
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public update(data: ParsedOrcaData): void {
    const oldKey = this.currentData.filePath;
    if (oldKey !== data.filePath) {
      OrcaViewerPanel.panels.delete(oldKey);
      OrcaViewerPanel.panels.set(data.filePath, this);
    }
    this.currentData = data;
    this.panel.title = `ORCA 6: ${data.fileName}`;
    if (this.isReady) {
      this.postData();
    }
  }

  private postData(): void {
    const cfg = vscode.workspace.getConfiguration('orcaHelper');
    const relatedFiles = findRelatedOrcaFiles(this.currentData.filePath).filter(
      (r) => r.kind !== 'prop'
    );
    this.panel.webview.postMessage({
      type: 'loadData',
      data: this.currentData,
      relatedFiles,
      config: {
        defaultRepresentation: cfg.get<string>('defaultRepresentation', 'ballstick'),
        showGhostAtoms: cfg.get<boolean>('showGhostAtoms', true),
        irBroadeningFwhm: cfg.get<number>('irBroadeningFwhm', 20),
        uvBroadeningEv: cfg.get<number>('uvBroadeningEv', 0.3)
      }
    });
  }

  private async loadRelatedFile(filePath: string): Promise<void> {
    if (!filePath || !fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(`File not found: ${filePath}`);
      return;
    }
    try {
      const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === filePath);
      const text = openDoc ? openDoc.getText() : fs.readFileSync(filePath, 'utf8');
      const cfg = vscode.workspace.getConfiguration('orcaHelper');
      const rawParsed = parseAnyOrcaFile(
        text,
        filePath,
        cfg.get<number>('shortContactThreshold', 0.5)
      );
      if (!rawParsed) {
        vscode.window.showWarningMessage(
          `Could not parse "${path.basename(filePath)}" as an ORCA structure/trajectory/Hessian file.`
        );
        return;
      }
      this.update(enrichParsedWithSiblingHess(rawParsed));
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to load ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async exportVibrationXyz(
    frame: GeometryFrame,
    mode: VibrationalMode,
    amplitude: number
  ): Promise<void> {
    if (!frame || !mode || !mode.displacements || mode.displacements.length === 0) {
      return;
    }
    const baseName = path.basename(
      this.currentData.filePath,
      path.extname(this.currentData.filePath)
    );
    const defaultUri = vscode.Uri.file(
      path.join(path.dirname(this.currentData.filePath), `${baseName}_mode${mode.mode}.xyz`)
    );
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'XYZ Trajectory': ['xyz'] }
    });
    if (!saveUri) {
      return;
    }

    let maxD = 0;
    for (const d of mode.displacements) {
      maxD = Math.max(maxD, Math.hypot(d.dx, d.dy, d.dz));
    }
    const normFactor = maxD > 1e-6 ? 1 / maxD : 1;
    const nFrames = 20;
    const outLines: string[] = [];

    for (let f = 0; f < nFrames; f++) {
      const phase = Math.sin((2 * Math.PI * f) / nFrames);
      const scale = phase * amplitude * normFactor;
      outLines.push(String(frame.atoms.length));
      outLines.push(
        `Mode ${mode.mode} (${mode.frequency.toFixed(2)} cm^-1) frame ${f + 1}/${nFrames}`
      );
      for (let i = 0; i < frame.atoms.length; i++) {
        const a = frame.atoms[i];
        const d = mode.displacements[i] ?? { dx: 0, dy: 0, dz: 0 };
        const x = a.x + d.dx * scale;
        const y = a.y + d.dy * scale;
        const z = a.z + d.dz * scale;
        outLines.push(
          `  ${a.element.padEnd(3)} ${x.toFixed(8).padStart(14)} ${y.toFixed(8).padStart(14)} ${z.toFixed(8).padStart(14)}`
        );
      }
    }

    fs.writeFileSync(saveUri.fsPath, outLines.join('\n') + '\n', 'utf8');
    vscode.window.showInformationMessage(
      `Saved ${nFrames}-frame vibration animation to ${path.basename(saveUri.fsPath)}.`
    );
  }

  private async jumpToSourceLine(line: number): Promise<void> {
    try {
      const uri = vscode.Uri.file(this.currentData.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
      const safeLine = Math.min(Math.max(0, line), Math.max(0, doc.lineCount - 1));
      const pos = new vscode.Position(safeLine, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenter
      );
    } catch {
      // ignore if file unavailable
    }
  }

  private async copyOrcaBlock(
    frame: GeometryFrame,
    charge: number,
    multiplicity: number
  ): Promise<void> {
    const lines = [`* xyz ${charge} ${multiplicity}`];
    for (const a of frame.atoms) {
      const tag = a.isGhost ? `${a.element} :` : a.element;
      lines.push(
        `  ${tag.padEnd(4)} ${a.x.toFixed(8).padStart(14)} ${a.y.toFixed(8).padStart(14)} ${a.z.toFixed(8).padStart(14)}`
      );
    }
    lines.push('*');
    await vscode.env.clipboard.writeText(lines.join('\n'));
    vscode.window.showInformationMessage(
      `Copied ${frame.atoms.length}-atom ORCA * xyz block (${frame.label}) to clipboard.`
    );
  }

  private async exportFrameXyz(frame: GeometryFrame): Promise<void> {
    const baseName = path.basename(
      this.currentData.filePath,
      path.extname(this.currentData.filePath)
    );
    const defaultUri = vscode.Uri.file(
      path.join(path.dirname(this.currentData.filePath), `${baseName}_frame${frame.index + 1}.xyz`)
    );
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'XYZ Coordinates': ['xyz'] }
    });
    if (!saveUri) {
      return;
    }
    const comment =
      frame.energy !== undefined
        ? `${frame.label} E = ${frame.energy.toFixed(12)} Eh`
        : frame.label;
    const lines = [String(frame.atoms.length), comment];
    for (const a of frame.atoms) {
      lines.push(
        `  ${a.element.padEnd(3)} ${a.x.toFixed(8).padStart(14)} ${a.y.toFixed(8).padStart(14)} ${a.z.toFixed(8).padStart(14)}`
      );
    }
    fs.writeFileSync(saveUri.fsPath, lines.join('\n') + '\n', 'utf8');
    vscode.window.showInformationMessage(`Saved ${path.basename(saveUri.fsPath)}.`);
  }

  private async savePng(dataUrl: string): Promise<void> {
    const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) {
      return;
    }
    const baseName = path.basename(
      this.currentData.filePath,
      path.extname(this.currentData.filePath)
    );
    const defaultUri = vscode.Uri.file(
      path.join(path.dirname(this.currentData.filePath), `${baseName}_3d.png`)
    );
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'PNG Image': ['png'] }
    });
    if (!saveUri) {
      return;
    }
    fs.writeFileSync(saveUri.fsPath, Buffer.from(match[1], 'base64'));
    vscode.window.showInformationMessage(`Saved screenshot to ${path.basename(saveUri.fsPath)}.`);
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'viewer.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'viewer.js'));
    const threeDmolUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vendor', '3Dmol-min.js')
    );
    const chartJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vendor', 'chart.umd.min.js')
    );

    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data: blob:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource}`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ORCA 6 Helper Viewer</title>
  <link rel="stylesheet" href="${cssUri}" />
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="topbar-left">
        <span id="file-title" class="file-title">Loading...</span>
        <span id="status-badge" class="badge badge-info">ORCA 6</span>
        <span id="version-badge" class="badge badge-info hidden"></span>
      </div>
      <div class="topbar-actions">
        <button id="btn-copy-orca" title="Copy current frame as ORCA * xyz block">Copy * xyz</button>
        <button id="btn-export-xyz" title="Save current frame as .xyz">Export XYZ</button>
        <button id="btn-screenshot" title="Save 3D view as PNG">PNG</button>
      </div>
    </header>

    <div id="related-bar" class="related-bar hidden"></div>

    <div class="workspace">
      <!-- Left: 3D Molecular Viewer -->
      <section class="viewer-pane">
        <div class="viewer-toolbar">
          <select id="rep-select" title="3D Representation">
            <option value="ballstick">Ball &amp; Stick</option>
            <option value="stick">Stick</option>
            <option value="sphere">CPK Sphere</option>
            <option value="line">Wireframe</option>
          </select>
          <select id="label-select" title="Atom Labels">
            <option value="none">Labels: Off</option>
            <option value="element">Element</option>
            <option value="index">ORCA Index (0-based)</option>
            <option value="elemIndex">Elem + Index</option>
            <option value="charge">Partial Charge</option>
          </select>
          <select id="color-select" title="Atom Coloring">
            <option value="element">Color: Element</option>
            <option value="mulliken">Charge: Mulliken</option>
            <option value="loewdin">Charge: Loewdin</option>
            <option value="hirshfeld">Charge: Hirshfeld</option>
          </select>
          <button id="btn-measure" title="Click 2/3/4 atoms to measure distance, angle, dihedral">Measure</button>
          <button id="btn-vibrate-quick" class="hidden" title="Animate normal-mode vibrations in 3D">〰 Vibrations</button>
          <button id="btn-reset-view" title="Reset camera">Reset</button>
          <button id="btn-bg-toggle" title="Toggle Dark/Light 3D background">BG</button>
          <label id="wrap-ghosts"><input type="checkbox" id="chk-ghosts" checked /> Ghosts</label>
          <label id="wrap-dipole" class="hidden"><input type="checkbox" id="chk-dipole" /> Dipole</label>
          <label id="wrap-grad" class="hidden"><input type="checkbox" id="chk-grad" checked /> Gradients</label>
        </div>

        <div class="mol-stage-wrap">
          <div id="mol-viewport"></div>
          <div class="stage-overlay">
            <div id="atom-info-chip" class="overlay-chip hidden"></div>
          </div>
          <div id="measure-overlay" class="measure-overlay hidden">
            <span id="measure-text"></span>
            <button id="btn-clear-measure">Clear</button>
          </div>
        </div>

        <div id="vib-bar" class="vib-bar hidden">
          <button id="btn-vib-prev" title="Previous vibrational mode (↑)">◀</button>
          <strong id="vib-label">Mode</strong>
          <button id="btn-vib-next" title="Next vibrational mode (↓)">▶</button>
          <label>Amp <input id="vib-amp" type="range" min="0.1" max="1.2" step="0.05" value="0.45" /></label>
          <label>Speed <input id="vib-speed" type="range" min="0.3" max="2.5" step="0.1" value="1.0" /></label>
          <label><input type="checkbox" id="chk-vib-vectors" /> Vectors</label>
          <button id="btn-export-vib-xyz" title="Export 20-frame vibration animation as .xyz">Export XYZ</button>
          <button id="btn-stop-vib" class="primary">Stop</button>
        </div>

        <div id="traj-bar" class="traj-bar hidden">
          <div class="traj-row">
            <button id="btn-first" title="First Frame">|◀</button>
            <button id="btn-prev" title="Previous Frame">◀</button>
            <button id="btn-play" class="primary">▶ Play</button>
            <button id="btn-next" title="Next Frame">▶</button>
            <button id="btn-last" title="Last Frame">▶|</button>
            <input id="traj-slider" class="traj-slider" type="range" min="0" max="0" value="0" />
            <select id="traj-speed" title="Playback Speed">
              <option value="0.5">0.5x</option>
              <option value="1" selected>1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
            <label><input type="checkbox" id="traj-loop" checked /> Loop</label>
            <button id="btn-jump-frame" title="Jump to this cycle/frame in text editor">Go to Line</button>
          </div>
          <div id="traj-info" class="traj-info"></div>
        </div>
      </section>

      <!-- Right: Analysis Tabs -->
      <section class="analysis-pane">
        <div class="tabs">
          <button class="tab-btn active" data-tab="summary" id="tab-btn-summary">Summary</button>
          <button class="tab-btn hidden" data-tab="conv" id="tab-btn-conv">Convergence &amp; Energy</button>
          <button class="tab-btn hidden" data-tab="freq" id="tab-btn-freq">Frequencies &amp; IR</button>
          <button class="tab-btn hidden" data-tab="uv" id="tab-btn-uv">UV-Vis</button>
          <button class="tab-btn hidden" data-tab="orb" id="tab-btn-orb">Orbitals &amp; Charges</button>
        </div>

        <!-- Summary Tab -->
        <div class="tab-body tab-panel" id="panel-summary">
          <div id="summary-kpis" class="kpi-grid"></div>

          <div id="summary-keywords-sec" class="section-card hidden">
            <div class="section-title">Simple Input Keywords</div>
            <div id="summary-keywords" class="keyword-pills"></div>
          </div>

          <div id="summary-conv-sec" class="section-card hidden">
            <div class="section-title" id="summary-conv-title">Geometry Convergence</div>
            <table>
              <thead>
                <tr><th>Item</th><th>Value</th><th>Tolerance</th><th>Status</th></tr>
              </thead>
              <tbody id="summary-conv-body"></tbody>
            </table>
          </div>

          <div id="summary-thermo-sec" class="section-card hidden">
            <div class="section-title">Thermochemistry</div>
            <table>
              <tbody id="summary-thermo-body"></tbody>
            </table>
          </div>

          <div id="summary-errors-sec" class="section-card hidden">
            <div class="section-title">Errors &amp; Warnings (click to jump)</div>
            <div id="summary-errors-list" class="msg-list"></div>
          </div>
        </div>

        <!-- Convergence & Energy Tab -->
        <div class="tab-body tab-panel hidden" id="panel-conv">
          <div id="chart-energy-card" class="section-card hidden">
            <div class="section-title">
              <span>Energy Profile (click point to view 3D frame)</span>
              <select id="energy-unit">
                <option value="kcal" selected>ΔE (kcal/mol)</option>
                <option value="kj">ΔE (kJ/mol)</option>
                <option value="eh">Absolute (Eh)</option>
              </select>
            </div>
            <div class="chart-box"><canvas id="chart-energy"></canvas></div>
          </div>

          <div id="chart-grad-card" class="section-card hidden">
            <div class="section-title">Geometry Gradient &amp; Step Convergence</div>
            <div class="chart-box"><canvas id="chart-grad"></canvas></div>
          </div>

          <div id="chart-scf-card" class="section-card hidden">
            <div class="section-title">Latest SCF Convergence (|ΔE|)</div>
            <div class="chart-box"><canvas id="chart-scf"></canvas></div>
          </div>
        </div>

        <!-- Frequencies & IR Tab -->
        <div class="tab-body tab-panel hidden" id="panel-freq">
          <div id="chart-ir-card" class="section-card hidden">
            <div class="section-title">
              <span>Simulated IR Spectrum</span>
              <span class="chart-controls">
                FWHM <input id="ir-fwhm" type="range" min="4" max="60" step="2" value="20" />
                <span id="ir-fwhm-val">20 cm⁻¹</span>
              </span>
            </div>
            <div class="chart-box"><canvas id="chart-ir"></canvas></div>
          </div>

          <div class="section-card">
            <div class="section-title">
              <span>Vibrational Modes (click row to animate in 3D)</span>
              <label style="font-weight:normal;font-size:11.5px;">
                <input type="checkbox" id="chk-hide-tr" checked /> Hide 0 cm⁻¹ (T/R)
              </label>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr><th>Mode</th><th>Freq (cm⁻¹)</th><th>IR Int (km/mol)</th><th>Anim</th></tr>
                </thead>
                <tbody id="freq-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- UV-Vis Tab -->
        <div class="tab-body tab-panel hidden" id="panel-uv">
          <div class="section-card">
            <div class="section-title">
              <span>UV-Vis Absorption Spectrum (TD-DFT)</span>
              <span class="chart-controls">
                σ <input id="uv-sigma" type="range" min="0.05" max="0.8" step="0.05" value="0.3" />
                <span id="uv-sigma-val">0.30 eV</span>
              </span>
            </div>
            <div class="chart-box"><canvas id="chart-uv"></canvas></div>
          </div>

          <div class="section-card">
            <div class="section-title">Excited States</div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr><th>#</th><th>Transition</th><th>E (eV)</th><th>λ (nm)</th><th>f_osc</th></tr>
                </thead>
                <tbody id="uv-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Orbitals & Charges Tab -->
        <div class="tab-body tab-panel hidden" id="panel-orb">
          <div id="orb-section" class="section-card hidden">
            <div class="section-title">Frontier Molecular Orbitals</div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr><th>NO</th><th>Type</th><th>Occ</th><th>E (Eh)</th><th>E (eV)</th></tr>
                </thead>
                <tbody id="orb-table-body"></tbody>
              </table>
            </div>
          </div>

          <div id="charges-section" class="section-card hidden">
            <div class="section-title">
              <span>Atomic Charges (click row to flash atom)</span>
              <select id="charge-scheme">
                <option value="mulliken">Mulliken</option>
                <option value="loewdin">Loewdin</option>
                <option value="hirshfeld">Hirshfeld</option>
              </select>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr><th>Index</th><th>Elem</th><th>Charge</th></tr>
                </thead>
                <tbody id="charges-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <script src="${threeDmolUri}"></script>
  <script src="${chartJsUri}"></script>
  <script src="${jsUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    OrcaViewerPanel.panels.delete(this.currentData.filePath);
    while (this.disposables.length > 0) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}
