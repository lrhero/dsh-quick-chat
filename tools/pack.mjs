// Builds the tarball a release attaches: dist/dsh-quick-chat-<version>.tgz,
// plus a version-less copy the storefront can link as `latest/download`, plus
// SHA256SUMS.txt. The file list comes from `npm pack`, i.e. package.json files,
// so this script and a real publish can never disagree.
//
//   node tools/pack.mjs            # build into dist/
//   node tools/pack.mjs --dry-run  # only print and validate the file list
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const dryRun = process.argv.includes('--dry-run');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const REQUIRED = [
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'icon.png',
  'locale/en.json',
  'locale/zh.json',
  'docs/DETAIL.md',
  'docs/DETAIL.zh.md',
  'docs/preview.svg',
  'screenshots.json',
  'README.md',
  'LICENSE',
];
const FORBIDDEN = ['test/', 'tools/', 'assets/', '.github/', 'dist/', 'node_modules/'];

function npm(command) {
  // One command string, so Windows can resolve `npm.cmd` without Node's
  // shell-plus-args deprecation. Nothing here interpolates user input.
  const result = spawnSync(process.platform === 'win32' ? `npm.cmd ${command}` : `npm ${command}`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`npm ${command} failed with exit code ${result.status}`);
  }
  return result.stdout;
}

function fileList(command) {
  const raw = npm(command);
  // `npm pack --json` prints an array; npm may prefix it with notices on stderr,
  // and older npm versions print an object instead, so parse defensively.
  const start = raw.indexOf('[');
  if (start < 0) throw new Error(`could not find JSON in npm pack output:\n${raw}`);
  const [entry] = JSON.parse(raw.slice(start));
  return entry;
}

fs.mkdirSync(DIST, { recursive: true });

const listing = fileList('pack --json --dry-run --pack-destination dist');
const paths = listing.files.map((file) => file.path);

const missing = REQUIRED.filter((file) => !paths.includes(file));
if (missing.length) throw new Error(`the tarball is missing required files: ${missing.join(', ')}`);

const leaked = paths.filter((file) => FORBIDDEN.some((prefix) => file.startsWith(prefix)));
if (leaked.length) throw new Error(`the tarball ships dev files: ${leaked.join(', ')}`);

const bytes = listing.files.reduce((sum, file) => sum + file.size, 0);
console.log(`pack: ${listing.name}@${listing.version} — ${paths.length} files, ${(bytes / 1024).toFixed(0)} KiB unpacked`);
if (bytes > 2 * 1024 * 1024) console.warn(`pack: warning — ${(bytes / 1024 / 1024).toFixed(2)} MiB is large for a release asset`);

if (dryRun) {
  console.log('pack: dry run, nothing written');
  process.exit(0);
}

const built = fileList('pack --json --pack-destination dist');
const tarball = path.join(DIST, built.filename);
const stable = path.join(DIST, `${pkg.name}.tgz`);
fs.copyFileSync(tarball, stable);

const digest = createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
const sums = [
  `${digest}  ${path.basename(tarball)}`,
  `${digest}  ${path.basename(stable)}`,
  '',
].join('\n');
fs.writeFileSync(path.join(DIST, 'SHA256SUMS.txt'), sums);

console.log(`pack: ${path.relative(ROOT, tarball)} (${(fs.statSync(tarball).size / 1024).toFixed(0)} KiB)`);
console.log(`pack: ${path.relative(ROOT, stable)} (version-less alias for latest/download)`);
console.log(`pack: sha256 ${digest}`);
