import fs from 'node:fs';
import path from 'node:path';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

async function build() {
  const bundle = await rollup({
    input: path.join(root, 'src', 'main.js'),
    plugins: [
      resolve(),
      terser({
        compress: {
          passes: 2,
        },
        format: {
          comments: false,
        },
      }),
    ],
  });

  const { output } = await bundle.generate({
    format: 'iife',
    name: 'SkyCrownAthletic',
    inlineDynamicImports: true,
  });

  await bundle.close();

  const jsCode = output[0].code.replace(/<\/script>/gi, '<\\/script>');
  const template = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
  const finalHtml = template.replace(
    '<!-- INLINE_BUNDLE_SCRIPT -->',
    () => `<script>\n${jsCode}\n</script>`
  );

  const outPath = path.join(distDir, 'index.html');
  fs.writeFileSync(outPath, finalHtml, 'utf8');

  const workspaceOut = '/home/antigravity/sky-crown-athletic.html';
  fs.writeFileSync(workspaceOut, finalHtml, 'utf8');

  const kb = (Buffer.byteLength(finalHtml, 'utf8') / 1024).toFixed(1);
  console.log(`Built single-file offline bundle: ${outPath} (${kb} KB)`);
  console.log(`Copied to workspace root: ${workspaceOut}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
