import * as vscode from 'vscode';
import {
  BLOCK_MAP,
  ORCA6_BLOCKS,
  ORCA6_SIMPLE_KEYWORDS,
  ORCA6_SOLVENTS
} from '../data/orca6Keywords';

const SINGLE_LINE_BLOCKS = new Set(['maxcore', 'moinp', 'base', 'id']);

function findEnclosingBlock(document: vscode.TextDocument, lineNum: number): string | undefined {
  let depth = 0;
  for (let i = lineNum; i >= 0; i--) {
    const raw = document.lineAt(i).text;
    const text = raw.replace(/#.*$/, '').trim();
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
      if (SINGLE_LINE_BLOCKS.has(name) || /\bend\b/i.test(m[2])) {
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

export class OrcaCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] | undefined {
    const lineText = document.lineAt(position.line).text;
    const prefix = lineText.slice(0, position.character);

    // Don't complete inside comments
    if (prefix.includes('#')) {
      return undefined;
    }

    // 1. Inside CPCM(...), SMD(...), ALPB(...) -> suggest solvent names
    const solvMatch = prefix.match(/(?:CPCM|SMD|ALPB)\s*\(\s*([A-Za-z0-9]*)$/i);
    if (solvMatch) {
      return ORCA6_SOLVENTS.map((solv) => {
        const item = new vscode.CompletionItem(solv, vscode.CompletionItemKind.Value);
        item.detail = 'ORCA 6 Solvent';
        return item;
      });
    }

    // 2. Simple input line (! ...)
    if (/^\s*!/.test(prefix)) {
      return ORCA6_SIMPLE_KEYWORDS.map((kw) => {
        const item = new vscode.CompletionItem(kw.name, vscode.CompletionItemKind.Keyword);
        item.detail = `[ORCA 6 • ${kw.category}]`;
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${kw.name}** *(${kw.category})*\n\n${kw.summary}`);
        if (kw.orca6Note) {
          md.appendMarkdown(`\n\n> **ORCA 6:** ${kw.orca6Note}`);
        }
        item.documentation = md;
        if (kw.snippet) {
          item.insertText = new vscode.SnippetString(kw.snippet);
        }
        return item;
      });
    }

    // 3. Block directive (%...)
    const pctMatch = prefix.match(/^\s*(%[A-Za-z_]*)$/);
    if (pctMatch) {
      const replaceRange = new vscode.Range(
        position.line,
        prefix.lastIndexOf('%'),
        position.line,
        position.character
      );
      return ORCA6_BLOCKS.map((b) => {
        const item = new vscode.CompletionItem(`%${b.name}`, vscode.CompletionItemKind.Module);
        item.detail = b.singleLine ? 'ORCA 6 Directive' : 'ORCA 6 Input Block';
        item.documentation = new vscode.MarkdownString(b.summary);
        item.insertText = new vscode.SnippetString(b.snippet);
        item.range = replaceRange;
        return item;
      });
    }

    // 4. Coordinate block header (* ...)
    if (/^\s*\*\s*[A-Za-z]*$/.test(prefix)) {
      const starCol = prefix.indexOf('*');
      const replaceRange = new vscode.Range(position.line, starCol, position.line, position.character);
      const coordItems: [string, string, string][] = [
        ['* xyz', '* xyz ${1:0} ${2:1}\n$0\n*', 'Inline Cartesian coordinates (Angstrom)'],
        ['* xyzfile', '* xyzfile ${1:0} ${2:1} ${3:geometry.xyz}', 'External XYZ coordinate file'],
        ['* int', '* int ${1:0} ${2:1}\n$0\n*', 'Internal Z-matrix coordinates'],
        ['* gzmt', '* gzmt ${1:0} ${2:1}\n$0\n*', 'Gaussian-style Z-matrix coordinates']
      ];
      return coordItems.map(([label, snip, desc]) => {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
        item.detail = 'ORCA 6 Coordinates';
        item.documentation = desc;
        item.insertText = new vscode.SnippetString(snip);
        item.range = replaceRange;
        return item;
      });
    }

    // 5. Inside a %block -> suggest block-specific parameters
    const blockName = findEnclosingBlock(document, position.line);
    if (blockName) {
      const blockDoc = BLOCK_MAP.get(blockName);
      if (blockDoc && blockDoc.params.length > 0) {
        const items = blockDoc.params.map((p) => {
          const item = new vscode.CompletionItem(p.name, vscode.CompletionItemKind.Property);
          item.detail = `%${blockDoc.name} • ${p.type}${p.defaultVal ? ` (default: ${p.defaultVal})` : ''}`;
          item.documentation = new vscode.MarkdownString(p.summary);
          if (p.snippet) {
            item.insertText = new vscode.SnippetString(p.snippet);
          } else if (p.type === 'boolean') {
            item.insertText = new vscode.SnippetString(`${p.name} \${1|true,false|}`);
          } else if (p.type === 'string') {
            item.insertText = new vscode.SnippetString(`${p.name} "\${1}"`);
          }
          return item;
        });

        const endItem = new vscode.CompletionItem('end', vscode.CompletionItemKind.Keyword);
        endItem.detail = `Close %${blockDoc.name} block`;
        items.push(endItem);
        return items;
      }
    }

    return undefined;
  }
}
