import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const watch = process.argv.includes('--watch');
const root = path.resolve(import.meta.dirname, '..');

function copyVendorAssets() {
  const vendorDir = path.join(root, 'media', 'vendor');
  fs.mkdirSync(vendorDir, { recursive: true });

  const assets = [
    {
      from: path.join(root, 'node_modules', '3dmol', 'build', '3Dmol-min.js'),
      to: path.join(vendorDir, '3Dmol-min.js')
    },
    {
      from: path.join(root, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'),
      to: path.join(vendorDir, 'chart.umd.min.js')
    }
  ];

  for (const asset of assets) {
    if (!fs.existsSync(asset.from)) {
      // Fallback check for chart.js umd path
      if (asset.from.includes('chart.umd.min.js')) {
        const alt = path.join(root, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
        if (fs.existsSync(alt)) {
          fs.copyFileSync(alt, asset.to);
          continue;
        }
      }
      throw new Error(`Missing vendor asset: ${asset.from}`);
    }
    fs.copyFileSync(asset.from, asset.to);
  }
  console.log('[build] Copied vendor assets to media/vendor/');
}

async function main() {
  copyVendorAssets();

  const ctx = await esbuild.context({
    entryPoints: [path.join(root, 'src', 'extension.ts')],
    bundle: true,
    format: 'cjs',
    minify: !watch,
    sourcemap: watch,
    platform: 'node',
    target: 'node18',
    outfile: path.join(root, 'dist', 'extension.js'),
    external: ['vscode'],
    logLevel: 'info'
  });

  if (watch) {
    await ctx.watch();
    console.log('[build] Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
