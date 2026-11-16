// Packaging guard for dsh-quick-chat — no DSH, no network, no browser.
//
//   node test/package.mjs
//
// Everything here answers one question: would a marketplace listing and a
// `dsh plugin add` of this checkout still work? It checks the manifest, the
// bundle patch, the locale metadata the Plugin Manager reads, the icon and
// screenshot files a storefront fetches, and the version strings that drift.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const fail = (message) => {
  throw new Error(message);
};

let checks = 0;
const ok = (label) => {
  checks += 1;
  console.log(`package ok: ${label}`);
};

const pkg = readJson('package.json');

// 1. identity: the repo name, the package name, the Loader row and the client
//    module id must all agree, or `dsh plugin add` installs something the
//    profile cannot resolve.
if (pkg.name !== 'dsh-quick-chat') fail(`package name drifted: ${pkg.name}`);
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) fail(`version is not semver: ${pkg.version}`);
ok(`identity and version (${pkg.name}@${pkg.version})`);

const patch = read('cordis.patch.yml');
const rowNames = [...patch.matchAll(/^\s*name:\s*['"]?([^'"\n]+)['"]?\s*$/gm)].map((m) => m[1].trim());
if (rowNames.length !== 1) fail(`expected exactly one Loader row in cordis.patch.yml, found ${rowNames.length}`);
if (rowNames[0] !== pkg.name) fail(`patch row name ${rowNames[0]} does not match package name ${pkg.name}`);
if (!/^-\s+insert:/m.test(patch)) fail('cordis.patch.yml has no insert list, so installing the bundle would do nothing');
ok('bundle patch inserts one row named after the package');

const client = read('client.js');
const moduleId = /__ModuleLoader__\.load\(\{\s*\n\s*id:\s*'([^']+)'/.exec(client)?.[1];
if (moduleId !== pkg.name) fail(`client module id ${moduleId} does not match package name ${pkg.name}`);
if (!/factory:\s*\(require\)/.test(client)) fail('client.js is not a module-loader factory');
ok('client module registers under the package name');

// 2. the DSH manifest: without dsh.bundle.patch the market will not list it.
if (pkg.dsh?.manifestVersion !== 1) fail('package.json dsh.manifestVersion must be 1');
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') fail('package.json dsh.bundle.patch is missing or wrong');
if (!exists('cordis.patch.yml')) fail('cordis.patch.yml is missing');
if (!pkg.engines?.dsh) fail('engines.dsh is required so a storefront can filter by host version');
if (!pkg.engines?.node) fail('engines.node is required');
ok('dsh manifest, engines and host range');

// 3. metadata resources the Plugin Manager reads without activating the plugin.
for (const subpath of ['./icon', './locale/*.json']) {
  if (!pkg.exports?.[subpath]) fail(`exports is missing ${subpath}`);
}
const locales = ['locale/en.json', 'locale/zh.json'];
for (const file of locales) {
  if (!exists(file)) fail(`${file} is missing`);
  const meta = readJson(file).meta;
  if (!meta?.title || !meta?.description) fail(`${file} needs meta.title and meta.description`);
  if (!meta.detail) fail(`${file} needs meta.detail pointing at its feature image document`);
  if (!meta.detail.endsWith('.md')) fail(`${file} meta.detail must be a .md document: ${meta.detail}`);
  if (path.isAbsolute(meta.detail) || meta.detail.split('/').includes('..')) fail(`${meta.detail} must stay inside the package`);
  if (!exists(meta.detail)) fail(`${meta.detail} is declared in ${file} but does not exist`);
  const image = /!\[[^\]]*\]\(([^)]+)\)/.exec(read(meta.detail))?.[1];
  if (!image) fail(`${meta.detail} must be a single feature image line`);
  if (!/\.(svg|png|jpg|jpeg|webp)$/i.test(image)) fail(`${meta.detail} points at a non-image: ${image}`);
  if (!exists(path.join(path.dirname(meta.detail), image))) fail(`${meta.detail} image ${image} does not exist`);
}
const en = readJson('locale/en.json').meta;
if (pkg.description && en.description.length < pkg.description.length) fail('locale/en.json description is shorter than package.json description');
ok('locale metadata, detail documents and their images');

// 4. artwork limits enforced by the Plugin Manager and the market.
const iconBytes = fs.readFileSync(path.join(ROOT, 'icon.png'));
if (iconBytes.length > 256 * 1024) fail(`icon.png is ${iconBytes.length} bytes; the limit is 256 KiB`);
if (iconBytes.readUInt32BE(0) !== 0x89504e47) fail('icon.png does not start with a PNG signature');
const iconWidth = iconBytes.readUInt32BE(16);
const iconHeight = iconBytes.readUInt32BE(20);
if (iconWidth !== iconHeight) fail(`icon.png is ${iconWidth}x${iconHeight}; storefronts draw it in a square`);
ok(`icon.png is a ${iconWidth}x${iconHeight} PNG under 256 KiB`);

// 5. storefront screenshots: 1–8 images, relative paths, nothing outside the repo.
const shots = readJson('screenshots.json');
if (!Array.isArray(shots) || shots.length < 1 || shots.length > 8) fail('screenshots.json must list 1–8 images');
for (const shot of shots) {
  if (typeof shot !== 'string') fail('screenshots.json entries must be strings');
  if (path.isAbsolute(shot) || shot.startsWith('/') || shot.split('/').includes('..')) fail(`screenshot path must be relative and inside the package: ${shot}`);
  if (!/\.(png|jpe?g|webp)$/i.test(shot)) fail(`screenshot must be a raster image: ${shot}`);
  const bytes = fs.readFileSync(path.join(ROOT, shot));
  if (bytes.length < 1024) fail(`${shot} looks like a placeholder (${bytes.length} bytes)`);
}
ok(`screenshots.json lists ${shots.length} images`);

// 6. the published file list: runtime plus metadata, never the dev folders.
const RUNTIME = ['index.js', 'client.js', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'docs/DETAIL.md', 'docs/DETAIL.zh.md', 'docs/preview.svg', 'screenshots.json', 'README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE', 'icon.png'];
const files = pkg.files ?? [];
if (!files.length) fail('package.json files is empty; npm would publish the whole repo');
for (const file of RUNTIME) {
  const covered = files.some((entry) => {
    if (entry === file) return true;
    if (entry.endsWith('/*.json')) {
      // A `dir/*.ext` entry covers that extension inside that directory only.
      return path.posix.dirname(file) === entry.slice(0, -'/*.json'.length) && file.endsWith('.json');
    }
    // A bare directory entry covers everything below it.
    return file.startsWith(`${entry}/`) && fs.existsSync(path.join(ROOT, entry)) && fs.statSync(path.join(ROOT, entry)).isDirectory();
  });
  if (!covered) fail(`${file} is not in package.json files, so it would be missing from the tarball`);
}
for (const dev of ['test', 'tools', 'assets', '.github']) {
  if (files.some((entry) => entry === dev || entry.startsWith(`${dev}/`))) fail(`package.json files ships the dev folder ${dev}`);
}
for (const entry of files) {
  if (entry.includes('*')) {
    const dir = path.join(ROOT, path.dirname(entry));
    if (!fs.existsSync(dir)) fail(`files entry ${entry} points at a missing directory`);
  } else if (!exists(entry)) {
    fail(`files entry ${entry} does not exist`);
  }
}
ok('files list covers every runtime and metadata file, and excludes dev folders');

// 7. version strings that are easy to forget during a release.
const changelog = read('CHANGELOG.md');
const latestHeading = /^##\s+(\d+\.\d+\.\d+)/m.exec(changelog)?.[1];
if (latestHeading !== pkg.version) fail(`CHANGELOG.md starts at ${latestHeading}, package.json says ${pkg.version}`);
for (const readme of ['README.md', 'README.en.md']) {
  const badge = /badge\/version-(\d+\.\d+\.\d+)/.exec(read(readme))?.[1];
  if (badge && badge !== pkg.version) fail(`${readme} badge says ${badge}, package.json says ${pkg.version}`);
}
ok('CHANGELOG and README badges match the package version');

// 8. source-list sanity: a bad URL in the reference config breaks the first
//    render for every new user.
const urls = [...patch.matchAll(/^\s*url:\s*(\S+)\s*$/gm)].map((m) => m[1]);
if (urls.length < 1) fail('cordis.patch.yml declares no sources');
for (const url of urls) {
  if (!/^https?:\/\//.test(url)) fail(`source url is not http(s): ${url}`);
}
ok(`${urls.length} reference sources are http(s)`);

// 9. the awesome-list entry that gets merged in another repository: a wrong
//    url/name there links the card to the wrong project, and a non-GitHub icon
//    is rejected by that repository's CI.
const entry = read('market/lrhero__dsh-quick-chat.yml');
const field = (key) => new RegExp(`^${key}:\\s*'?"?([^'"\\n]+)'?"?\\s*$`, 'm').exec(entry)?.[1].trim();
if (field('url') !== 'https://github.com/lrhero/dsh-quick-chat') fail(`market entry url is ${field('url')}`);
if (field('name') !== 'lrhero/dsh-quick-chat') fail(`market entry name is ${field('name')}`);
const category = field('category');
const CATEGORIES = ['agi', 'ui', 'usage', 'theme', 'model', 'identity', 'session', 'memory', 'tools', 'wsl', 'browser', 'vision', 'voice', 'docs', 'skill', 'workflow', 'git', 'notify', 'dev', 'security', 'remote', 'market', 'fun', 'education'];
if (!CATEGORIES.includes(category)) fail(`market entry category ${category} is not one the list accepts`);
if (!/^icon:\s*https:\/\/raw\.githubusercontent\.com\/lrhero\/dsh-quick-chat\//m.test(entry)) fail('market entry icon must be a GitHub-hosted raster URL');
if (!/^tarball:\s*https:\/\/github\.com\/lrhero\/dsh-quick-chat\/releases\/latest\/download\/dsh-quick-chat\.tgz$/m.test(entry)) fail('market entry tarball must point at the version-less release asset');
ok('market entry matches the repository, category and asset URLs');

console.log(`package: ${checks} checks passed`);
