// 把 assets/voice/ 下的音频内嵌进 client.js 的 VOICES。
//
//   node tools/embed-voice.mjs
//
// 认这些文件名（大小写不敏感）：deepseek / doubao / gemini 加 .mp3 .wav .ogg
// .m4a .aac .flac。音频还没做好时不用跑这个脚本，VOICES 保持空字符串，
// 点击时静默跳过。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLIENT = path.join(ROOT, 'client.js');
const VOICE_DIR = path.join(ROOT, 'assets', 'voice');
const IDS = ['deepseek', 'doubao', 'gemini'];
const MIME = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
};

if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

const found = new Map();
for (const file of fs.readdirSync(VOICE_DIR)) {
    const ext = path.extname(file).toLowerCase();
    const id = path.basename(file, ext).toLowerCase();
    if (!IDS.includes(id) || !MIME[ext]) {
        if (file !== '.gitkeep') console.warn(`skip ${file}（不认识的格式或 id）`);
        continue;
    }
    const bytes = fs.readFileSync(path.join(VOICE_DIR, file));
    found.set(id, { mime: MIME[ext], base64: bytes.toString('base64'), file });
}

const lines = IDS.map((id) => {
    const hit = found.get(id);
    if (!hit) {
        console.log(`${id}: 留空`);
        return `      ${id}: '',`;
    }
    console.log(`${id}: ${hit.file} → ${(hit.base64.length / 1024).toFixed(1)} KB`);
    return `      ${id}: 'data:${hit.mime};base64,${hit.base64}',`;
});

const block = `const VOICES = {\n${lines.join('\n')}\n    };`;
const source = fs.readFileSync(CLIENT, 'utf8');
const pattern = /const VOICES = \{[\s\S]*?\n    \};/;
if (!pattern.test(source)) throw new Error('在 client.js 里没找到 VOICES 块');

const next = source.replace(pattern, () => block);
if (next === source) {
    console.log('内容没有变化，client.js 保持原样');
} else {
    fs.writeFileSync(CLIENT, next);
    console.log(`已写入 client.js（${(next.length / 1024).toFixed(1)} KB）`);
}
