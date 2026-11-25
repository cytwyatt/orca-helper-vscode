import * as path from 'path';
import * as vscode from 'vscode';
import { OutlineSection, ParsedOrcaData } from '../parsers';

function iconForCategory(category: OutlineSection['category']): vscode.ThemeIcon {
  switch (category) {
    case 'header':
    case 'job':
      return new vscode.ThemeIcon('symbol-module');
    case 'block':
      return new vscode.ThemeIcon('symbol-namespace');
    case 'coords':
      return new vscode.ThemeIcon('globe');
    case 'cycle':
      return new vscode.ThemeIcon('sync');
    case 'energy':
      return new vscode.ThemeIcon('flame');
    case 'converged':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
    case 'freq':
      return new vscode.ThemeIcon('pulse');
    case 'spectrum':
      return new vscode.ThemeIcon('graph-line');
    case 'thermo':
      return new vscode.ThemeIcon('dashboard');
    case 'orbitals':
      return new vscode.ThemeIcon('layers');
    case 'charges':
    case 'dipole':
      return new vscode.ThemeIcon('symbol-property');
    case 'error':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    case 'warning':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
    default:
      return new vscode.ThemeIcon('chevron-right');
  }
}

export class OrcaOutlineItem extends vscode.TreeItem {
  constructor(public readonly section: OutlineSection) {
    super(
      section.label,
      section.children && section.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.description = section.detail;
    this.iconPath = iconForCategory(section.category);
    this.tooltip = `${section.label}${section.detail ? ` — ${section.detail}` : ''} (Line ${section.line + 1})`;
    this.command = {
      command: 'orcaHelper.jumpToLine',
      title: 'Jump to Line',
      arguments: [section.line]
    };
  }
}

export class OrcaOutlineProvider implements vscode.TreeDataProvider<OrcaOutlineItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<OrcaOutlineItem | undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private data?: ParsedOrcaData;

  public update(data?: ParsedOrcaData): void {
    this.data = data;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: OrcaOutlineItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: OrcaOutlineItem): OrcaOutlineItem[] {
    if (!this.data) {
      return [];
    }
    const list = element ? element.section.children ?? [] : this.data.outline;
    return list.map((s) => new OrcaOutlineItem(s));
  }
}

export class SummaryEntryItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    icon: string,
    colorId?: string,
    command?: vscode.Command
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = colorId
      ? new vscode.ThemeIcon(icon, new vscode.ThemeColor(colorId))
      : new vscode.ThemeIcon(icon);
    this.command = command;
  }
}

export class OrcaSummaryProvider implements vscode.TreeDataProvider<SummaryEntryItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<SummaryEntryItem | undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private data?: ParsedOrcaData;

  public update(data?: ParsedOrcaData): void {
    this.data = data;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SummaryEntryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): SummaryEntryItem[] {
    if (!this.data) {
      return [
        new SummaryEntryItem(
          'Open an ORCA file',
          '.inp / .out / _trj.xyz / .trj / .allxyz / .hess / .engrad',
          'info'
        )
      ];
    }

    const d = this.data;
    const items: SummaryEntryItem[] = [];

    items.push(
      new SummaryEntryItem(
        'Open 3D & Analysis Viewer',
        d.fileName,
        'preview',
        undefined,
        { command: 'orcaHelper.openViewer', title: 'Open Viewer' }
      )
    );

    const statusIcon =
      d.status === 'converged' || d.status === 'normal'
        ? 'pass-filled'
        : d.status === 'error'
          ? 'error'
          : d.status === 'running'
            ? 'loading~spin'
            : 'file-code';
    const statusColor =
      d.status === 'converged' || d.status === 'normal'
        ? 'testing.iconPassed'
        : d.status === 'error'
          ? 'errorForeground'
          : undefined;
    items.push(
      new SummaryEntryItem(
        'Status',
        `${d.status.toUpperCase()}${d.orcaVersion ? ` (ORCA ${d.orcaVersion})` : ''}`,
        statusIcon,
        statusColor
      )
    );

    items.push(
      new SummaryEntryItem(
        'Formula',
        `${d.formula} (${d.nAtoms} atoms${d.nGhostAtoms ? `, ${d.nGhostAtoms} ghost` : ''})`,
        'globe'
      )
    );

    if (d.charge !== undefined && d.multiplicity !== undefined) {
      items.push(
        new SummaryEntryItem(
          'Charge / Mult',
          `${d.charge} / ${d.multiplicity}`,
          'symbol-number'
        )
      );
    }

    if (d.simpleInputKeywords && d.simpleInputKeywords.length > 0) {
      items.push(
        new SummaryEntryItem(
          'Keywords',
          d.simpleInputKeywords.join(' '),
          'symbol-keyword'
        )
      );
    }

    if (d.finalEnergyEh !== undefined) {
      items.push(
        new SummaryEntryItem('Final Energy', `${d.finalEnergyEh.toFixed(8)} Eh`, 'flame')
      );
    }

    if (d.optCycles.length > 0) {
      items.push(
        new SummaryEntryItem(
          'Optimization',
          `${d.optCycles.length} cycles${d.optConverged ? ' (Converged ✓)' : ''}`,
          d.optConverged ? 'pass-filled' : 'sync',
          d.optConverged ? 'testing.iconPassed' : undefined
        )
      );
    } else if (d.frames.length > 1) {
      items.push(
        new SummaryEntryItem('Trajectory', `${d.frames.length} frames`, 'play')
      );
    }

    if (d.frequencies.length > 0) {
      items.push(
        new SummaryEntryItem(
          'Frequencies',
          `${d.frequencies.length} modes (${d.imaginaryCount} imaginary)`,
          d.imaginaryCount > 0 ? 'warning' : 'pulse',
          d.imaginaryCount > 0 ? 'editorWarning.foreground' : undefined
        )
      );
    }

    if (d.thermo?.finalGibbsEh !== undefined) {
      items.push(
        new SummaryEntryItem(
          'Gibbs Free Energy',
          `${d.thermo.finalGibbsEh.toFixed(6)} Eh`,
          'dashboard'
        )
      );
    }

    if (d.homoLumoGapEv !== undefined) {
      items.push(
        new SummaryEntryItem(
          'HOMO–LUMO Gap',
          `${d.homoLumoGapEv.toFixed(3)} eV`,
          'layers'
        )
      );
    }

    if (d.dipole) {
      items.push(
        new SummaryEntryItem(
          'Dipole Moment',
          `${d.dipole.magnitudeDebye.toFixed(3)} Debye`,
          'arrow-up'
        )
      );
    }

    if (d.excitedStates.length > 0) {
      items.push(
        new SummaryEntryItem(
          'TD-DFT States',
          `${d.excitedStates.length} transitions`,
          'graph-line'
        )
      );
    }

    if (d.runtime) {
      items.push(new SummaryEntryItem('Runtime', d.runtime, 'clock'));
    }

    return items;
  }
}

export class OrcaWorkspaceFileItem extends vscode.TreeItem {
  constructor(public readonly uri: vscode.Uri, workspaceRoot?: string) {
    const fileName = path.basename(uri.fsPath);
    super(fileName, vscode.TreeItemCollapsibleState.None);
    const ext = path.extname(fileName).toLowerCase();
    this.description = workspaceRoot ? path.relative(workspaceRoot, path.dirname(uri.fsPath)) : '';
    this.tooltip = uri.fsPath;
    this.resourceUri = uri;
    this.iconPath =
      ext === '.inp'
        ? new vscode.ThemeIcon('file-code')
        : ext === '.trj' || ext === '.allxyz' || fileName.toLowerCase().endsWith('_trj.xyz')
          ? new vscode.ThemeIcon('play')
          : ext === '.xyz'
            ? new vscode.ThemeIcon('globe')
            : ext === '.hess'
              ? new vscode.ThemeIcon('pulse')
              : new vscode.ThemeIcon('output');
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [uri]
    };
  }
}

export class OrcaWorkspaceFilesProvider implements vscode.TreeDataProvider<OrcaWorkspaceFileItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    OrcaWorkspaceFileItem | undefined
  >();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: OrcaWorkspaceFileItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<OrcaWorkspaceFileItem[]> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return [];
    }
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const files = await vscode.workspace.findFiles(
      '**/*.{inp,out,xyz,trj,allxyz,hess,engrad}',
      '**/{node_modules,.git,slurm,slurm_result}/**',
      150
    );
    files.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return files.map((uri) => new OrcaWorkspaceFileItem(uri, root));
  }
}
