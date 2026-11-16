#!/usr/bin/env node
/**
 * Version stamping, so visitors always get the newest CSS and JavaScript.
 *
 * The web host sends no caching instructions, so browsers keep old copies of
 * files for days. This script gives every stylesheet and script a version
 * taken from its contents ("styles.css?v=3f9a1c2b7e"). When a file changes,
 * its address changes, and every browser downloads the new one at once.
 *
 * - <link href="assets/css/..."> and <script src="assets/js/..."> in every page
 *   get a ?v= stamp.
 * - Modules that import each other (assets/js/live/*.js) are stamped through
 *   an import map in each page's <head>.
 * - The stylesheet address inside live-status.js is stamped too.
 *
 * Runs automatically before every commit (.githooks/pre-commit). By hand:
 *   node tools/stamp-assets.mjs           update files, list what changed
 *   node tools/stamp-assets.mjs --check   only report; exit 1 if out of date
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const checkOnly = process.argv.includes('--check');
const changed = [];

const read = (path) => readFileSync(join(root, path), 'utf8');
const write = (path, text) => {
  if (read(path) === text) return;
  changed.push(path);
  if (!checkOnly) writeFileSync(join(root, path), text);
};
const hashOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);
const list = (dir, ext) => readdirSync(join(root, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => (dir ? `${dir}/${f}` : f));

const cssFiles = list('assets/css', '.css');
const jsFiles = [...list('assets/js', '.js'), ...list('assets/js/live', '.js')];
const moduleFiles = jsFiles.filter((f) => f.startsWith('assets/js/live/'));
const pages = list('', '.html');
const version = {};

// 1. Stylesheets first: scripts may point at them.
cssFiles.forEach((f) => { version[f] = hashOf(read(f)); });

// 2. Stylesheet addresses written inside scripts, e.g. '../../css/live.css?v=...'.
jsFiles.forEach((f) => {
  const text = read(f).replace(/css\/([\w-]+\.css)\?v=[\w-]+/g, (match, name) => {
    const v = version[`assets/css/${name}`];
    return v ? `css/${name}?v=${v}` : match;
  });
  write(f, text);
  version[f] = hashOf(checkOnly ? text : read(f));
});

// 3. Pages: stamp <link>/<script> addresses and keep one import map for modules.
const importMap = JSON.stringify({
  imports: Object.fromEntries(moduleFiles.map((f) => [`./${f}`, `./${f}?v=${version[f]}`])),
}, null, 2).split('\n').join('\n  ');
const mapBlock = `<script type="importmap" data-stamp>\n  ${importMap}\n  </script>`;
const MAP_RE = /<script type="importmap" data-stamp>[\s\S]*?<\/script>/;

pages.forEach((page) => {
  let text = read(page).replace(
    /((?:href|src)=")(assets\/(?:css|js)\/[\w/-]+\.(?:css|js))(?:\?v=[\w-]+)?(")/g,
    (match, before, path, after) => (version[path] ? `${before}${path}?v=${version[path]}${after}` : match),
  );
  const usesModules = /<script[^>]*type="module"/.test(text) || text.includes('assets/js/site.js');
  if (usesModules) {
    text = MAP_RE.test(text) ? text.replace(MAP_RE, mapBlock) : text.replace('</head>', `  ${mapBlock}\n</head>`);
  }
  write(page, text);
});

if (checkOnly) {
  if (changed.length) {
    console.log(`Out of date (run: node tools/stamp-assets.mjs):\n${changed.join('\n')}`);
    process.exit(1);
  }
  console.log('All asset stamps are up to date.');
} else {
  changed.forEach((f) => console.log(f));
}
