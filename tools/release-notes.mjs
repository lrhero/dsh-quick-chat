// Prints the CHANGELOG section for a version, for the GitHub Release body.
//
//   node tools/release-notes.mjs            # package.json version
//   node tools/release-notes.mjs 1.27.0
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = process.argv[2] ?? pkg.version;
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');

const lines = changelog.split(/\r?\n/);
const start = lines.findIndex((line) => new RegExp(`^##\\s+${version.replace(/\./g, '\\.')}\\b`).test(line));
if (start < 0) {
  console.error(`release-notes: CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
let end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
if (end < 0) end = lines.length;

const body = lines.slice(start + 1, end).join('\n').trim();
if (!body) {
  console.error(`release-notes: the ${version} section is empty`);
  process.exit(1);
}

process.stdout.write(`${body}\n`);
