// 重新生成 client.js 里的 FUN_ICONS。
//
//   node tools/embed-icons.mjs
//
// 读取 assets/icons/<id>-96.png，按 base64 内嵌成 data URI。改图后重跑即可。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLIENT = path.join(ROOT, 'client.js');
const ICON_DIR = path.join(ROOT, 'assets', 'icons');
const IDS = ['deepseek', 'doubao', 'gemini'];

const entries = [];
for (const id of IDS) {
    const file = path.join(ICON_DIR, `${id}-96.png`);
    if (!fs.existsSync(file)) {
        console.warn(`skip ${id}: ${file} 不存在`);
        continue;
    }
    const base64 = fs.readFileSync(file).toString('base64');
    entries.push(`      ${id}: 'data:image/png;base64,${base64}',`);
    console.log(`${id}: ${(base64.length / 1024).toFixed(1)} KB`);
}

const block = `const FUN_ICONS = {\n${entries.join('\n')}\n    };`;

const source = fs.readFileSync(CLIENT, 'utf8');
const pattern = /const FUN_ICONS = \{[\s\S]*?\n    \};/;
if (!pattern.test(source)) throw new Error('在 client.js 里没找到 FUN_ICONS 块');

const next = source.replace(pattern, () => block);
if (next === source) {
    console.log('内容没有变化，client.js 保持原样');
} else {
    fs.writeFileSync(CLIENT, next);
    console.log(`已写入 client.js（${(next.length / 1024).toFixed(1)} KB）`);
}

fs.writeFileSync(CLIENT, next);
console.log(`已写入 client.js（${(next.length / 1024).toFixed(1)} KB）`);
