import * as vscode from 'vscode';
import { lookupElement } from '../data/elements';
import {
  BLOCK_MAP,
  ORCA6_DEPRECATED_KEYWORDS,
  SIMPLE_KEYWORD_MAP
} from '../data/orca6Keywords';
import { parseOrcaInput } from '../parsers/orcaInputParser';

function findEnclosingBlock(document: vscode.TextDocument, lineNum: number): string | undefined {
  let depth = 0;
  for (let i = lineNum; i >= 0; i--) {
    const text = document.lineAt(i).text.replace(/#.*$/, '').trim();
    if (!text) {
      continue;
    }
    if (i < lineNum && /^\s*end\b/i.test(text)) {
      depth++;
      continue;
    }
    const m = text.match(/^%([A-Za-z_][A-Za-z0-9_]*)\b(.*)$/);
    if (m) {
      const name = m[1].toLowerCase();
      if (['maxcore', 'moinp', 'base', 'id'].includes(name) || /\bend\b/i.test(m[2])) {
        if (i === lineNum) {
          return name;
        }
        continue;
      }
      if (depth === 0) {
        return name;
      }
      depth--;
    }
  }
  return undefined;
}

export class OrcaHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const lineText = document.lineAt(position.line).text;

    // 1. Check if hovering over an atom coordinate line
    const parsed = parseOrcaInput(document.getText(), document.uri.fsPath);
    const atom = parsed.coordLineToAtomIndex.get(position.line);
    if (atom) {
      const elInfo = lookupElement(atom.element);
      const md = new vscode.MarkdownString();
      md.appendMarkdown(
        `### Atom **${atom.index}** *(0-based ORCA index)* — **${elInfo ? `${elInfo.symbol} (${elInfo.name})` : atom.element}**`
      );
      if (atom.isGhost) {
        md.appendMarkdown(` \`GHOST ATOM\``);
      }
      md.appendMarkdown('\n\n');
      const rows: string[] = [
        `| Property | Value |`,
        `| :--- | :--- |`,
        `| ORCA 0-based index | \`${atom.index}\` *(for \`%geom Constraints / Scan\`)* |`,
        `| 1-based index | \`${atom.index + 1}\` |`
      ];
      if (elInfo) {
        rows.push(`| Atomic number (Z) | ${atom.isGhost ? '0 (ghost; basis from Z=' + elInfo.z + ')' : elInfo.z} |`);
        rows.push(`| Atomic mass | ${elInfo.mass} amu |`);
      }
      rows.push(`| Coordinates (Å) | \`(${atom.x.toFixed(6)}, ${atom.y.toFixed(6)}, ${atom.z.toFixed(6)})\` |`);
      if (atom.fragment !== undefined) {
        rows.push(`| Fragment | ${atom.fragment} |`);
      }
      md.appendMarkdown(rows.join('\n'));
      return new vscode.Hover(md);
    }

    // Grab word around cursor including %, -, /, (, )
    const wordRange = document.getWordRangeAtPosition(position, /[%A-Za-z0-9_./()-]+/);
    if (!wordRange) {
      return undefined;
    }
    const token = document.getText(wordRange);
    const lower = token.toLowerCase();

    // 2. Block header hover (%scf, %geom, %maxcore, ...)
    if (token.startsWith('%')) {
      const bName = lower.slice(1);
      const block = BLOCK_MAP.get(bName);
      if (block) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### \`%${block.name}\` *(ORCA 6 ${block.singleLine ? 'Directive' : 'Block'})*\n\n`);
        md.appendMarkdown(`${block.summary}\n\n`);
        if (block.params.length > 0) {
          md.appendMarkdown(
            `**Common parameters:** ${block.params
              .slice(0, 8)
              .map((p) => `\`${p.name}\``)
              .join(', ')}`
          );
        }
        return new vscode.Hover(md, wordRange);
      }
    }

    // 3. Simple input line (! ...) keyword hover
    if (/^\s*!/.test(lineText)) {
      if (ORCA6_DEPRECATED_KEYWORDS[lower]) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### ⚠️ \`${token}\` *(Deprecated in ORCA 6)*\n\n`);
        md.appendMarkdown(ORCA6_DEPRECATED_KEYWORDS[lower]);
        return new vscode.Hover(md, wordRange);
      }

      const baseKey = lower.split('(')[0];
      const kw = SIMPLE_KEYWORD_MAP.get(lower) ?? SIMPLE_KEYWORD_MAP.get(baseKey);
      if (kw) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### \`${kw.name}\` *(${kw.category})*\n\n${kw.summary}`);
        if (kw.orca6Note) {
          md.appendMarkdown(`\n\n> **ORCA 6 Note:** ${kw.orca6Note}`);
        }
        return new vscode.Hover(md, wordRange);
      }
    }

    // 4. Inside a %block -> parameter hover
    const enclosing = findEnclosingBlock(document, position.line);
    if (enclosing) {
      const block = BLOCK_MAP.get(enclosing);
      const param = block?.params.find((p) => p.name.toLowerCase() === lower);
      if (block && param) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### \`${param.name}\` *(in \`%${block.name}\`)*\n\n`);
        md.appendMarkdown(`- **Type:** \`${param.type}\`\n`);
        if (param.defaultVal) {
          md.appendMarkdown(`- **Default:** \`${param.defaultVal}\`\n`);
        }
        md.appendMarkdown(`\n${param.summary}`);
        return new vscode.Hover(md, wordRange);
      }
    }

    return undefined;
  }
}
