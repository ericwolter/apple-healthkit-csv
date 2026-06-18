import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'html-minifier-terser';
import { inlineSource } from 'inline-source';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const outputDir = path.resolve(projectRoot, '..', 'dist', 'projects', 'apple-health-export');
const analyticsScript = '<script async src="https://www.googletagmanager.com/gtag/js?id=UA-42589062-1"></script>';

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

const inlinedHtml = await inlineSource(path.join(projectRoot, 'src', 'index.html'), {
  rootpath: path.join(projectRoot, 'src'),
  saveRemote: false,
});
const analyticsHtml = inlinedHtml.replace(/<head>/, `<head>\n${analyticsScript}`);
const minifyOptions = JSON.parse(await readFile(path.join(projectRoot, 'htmlmin.json'), 'utf8'));
const minifiedHtml = await minify(analyticsHtml, minifyOptions);

await writeFile(path.join(distDir, 'index.inline.html'), inlinedHtml);
await writeFile(path.join(distDir, 'index.analytics.html'), analyticsHtml);
await writeFile(path.join(outputDir, 'index.html'), minifiedHtml);
