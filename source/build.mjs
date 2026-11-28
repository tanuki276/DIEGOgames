import fs from 'node:fs';
import path from 'node:path';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const distDir = path.join(root, 'dist');
fs.mkdirSync(path.join(distDir, 'sky-crown-athletic'), { recursive: true });

async function buildSingleHtml(entryFile, templateFile, outFile, globalName) {
  const bundle = await rollup({
    input: entryFile,
    plugins: [
      resolve(),
      terser({
        compress: { passes: 2 },
        format: { comments: false },
      }),
    ],
  });

  const { output } = await bundle.generate({
    format: 'iife',
    name: globalName,
    inlineDynamicImports: true,
  });
  await bundle.close();

  const jsCode = output[0].code.replace(/<\/script>/gi, '<\\/script>');
  const template = fs.readFileSync(templateFile, 'utf8');
  const finalHtml = template.replace(
    '<!-- INLINE_BUNDLE_SCRIPT -->',
    () => `<script>\n${jsCode}\n</script>`
  );

  fs.writeFileSync(outFile, finalHtml, 'utf8');
  const kb = (Buffer.byteLength(finalHtml, 'utf8') / 1024).toFixed(1);
  console.log(`Built ${path.relative(root, outFile)} (${kb} KB)`);
}

async function main() {
  await buildSingleHtml(
    path.join(root, 'src', 'home', 'main.js'),
    path.join(root, 'src', 'home', 'template.html'),
    path.join(distDir, 'index.html'),
    'DiegoGamesHome'
  );
  await buildSingleHtml(
    path.join(root, 'src', 'game', 'main.js'),
    path.join(root, 'src', 'game', 'template.html'),
    path.join(distDir, 'sky-crown-athletic', 'index.html'),
    'SkyCrownAthleticV2'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
