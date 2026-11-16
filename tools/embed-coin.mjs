// 把 assets/coin/coin-front.png 与 coin-back.png 内嵌进 client.js 的 COIN_ART。
//
//   node tools/embed-coin.mjs
//
// 硬币图像是从参考照片里抠出来的圆形 PNG，改图后重跑本脚本。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLIENT = path.join(ROOT, 'client.js');
const DIR = path.join(ROOT, 'assets', 'coin');
const IDS = ['front', 'back'];

const entries = [];
for (const id of IDS) {
    const file = path.join(DIR, `coin-${id}.png`);
    if (!fs.existsSync(file)) {
        console.warn(`skip ${id}: ${file} 不存在`);
        continue;
    }
    const base64 = fs.readFileSync(file).toString('base64');
    entries.push(`      ${id}: 'data:image/png;base64,${base64}',`);
    console.log(`${id}: ${(base64.length / 1024).toFixed(1)} KB`);
}

const block = `const COIN_ART = {\n${entries.join('\n')}\n    };`;
const source = fs.readFileSync(CLIENT, 'utf8');
const pattern = /const COIN_ART = \{[\s\S]*?\n    \};/;
if (!pattern.test(source)) throw new Error('在 client.js 里没找到 COIN_ART 块');

const next = source.replace(pattern, () => block);
if (next === source) {
    console.log('内容没有变化，client.js 保持原样');
} else {
    fs.writeFileSync(CLIENT, next);
    console.log(`已写入 client.js（${(next.length / 1024).toFixed(1)} KB）`);
}
