// Offline smoke test for dsh-quick-chat — no DOM, no Electron, no network.
//
//   node test/smoke.mjs
//
// Covers: config normalization, both seats, the drawer's provider bar, the
// absence of any extra composer UI, and the sidebar fallback without the
// desktop bridge.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SOURCE = fileURLToPath(new URL('../client.js', import.meta.url));

const registered = [];
const slots = [];
const seats = [];
const opened = [];

const React = {
    Fragment: 'FRAGMENT',
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useRef: (initial) => ({ current: initial ?? null }),
    useState: (initial) => [initial, () => {}],
    useSyncExternalStore: (_subscribe, get) => get(),
    useEffect: () => {},
};

const storage = new Map();
const window = {
    open: (url) => opened.push({ via: 'window.open', url }),
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1200,
    innerHeight: 800,
    localStorage: {
        getItem: (key) => (storage.has(key) ? storage.get(key) : null),
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key),
    },
    __ModuleLoader__: { load: ({ id, factory }) => registered.push({ id, factory }) },
};

const audioPlayed = [];
// 模拟 DSH 渲染进程的真实 UA（含 Electron），用来验证 userAgent: electron 的解析
const ELECTRON_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dsh-desktop/0.2.2 Chrome/131.0.0.0 Electron/33.0.0 Safari/537.36';
const sandbox = {
    window,
    document: {
        querySelector: () => null,
        createElement: () => ({ setAttribute: () => {}, addEventListener: () => {}, remove: () => {}, loadURL: () => Promise.resolve() }),
    },
    Audio: class {
        constructor(src) {
            this.src = src;
            this.volume = 1;
            audioPlayed.push(this);
        }
        play() {
            return Promise.resolve();
        }
        pause() {}
    },
    console: { log: () => {}, warn: () => {}, error: console.error },
    URL,
    // 浏览器全局；冒烟测试里只需要存在，不让它真的排队
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    navigator: { userAgent: ELECTRON_UA },
    require: (name) => {
        if (name === 'react') return React;
        throw new Error(`unexpected module request: ${name}`);
    },
};
sandbox.globalThis = sandbox; // no dshDesktop on purpose

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), sandbox, { filename: SOURCE });

const { id, factory } = registered[0];
if (id !== 'dsh-quick-chat') throw new Error(`factory id mismatch: ${id}`);

const plugin = factory(sandbox.require);
// 只硬依赖 slots：把 sidebarRight 写进 inject，宿主一缺这个服务插件就静默不激活
if (JSON.stringify(plugin.inject) !== JSON.stringify(['slots'])) {
    throw new Error(`plugin.inject 应为 ['slots']，实际 ${JSON.stringify(plugin.inject)}`);
}

plugin.apply(
    {
        slots: {
            inject: (name, run) => (slots.push(name), run()),
            register: (definition, Component) => (seats.push({ definition, Component }), () => {}),
        },
        sidebarRight: { openTab: (kind, options) => opened.push({ via: 'openTab', kind, url: options.params.url }) },
    },
    {
        sources: [
            { id: 'kimi', label: 'Kimi', url: 'https://kimi.moonshot.cn/', icon: 'deepseek' },
            { id: 'bad', label: 'Broken', url: 'ftp://nope' },
            { id: 'ds', url: 'https://chat.deepseek.com/' },
        ],
    },
);

if (!slots.includes('conversation.session.header.utilities')) throw new Error('header seat missing');
if (!slots.includes('shell.overlay')) throw new Error('drawer seat missing');

// apply 必须留下一条诊断记录：下次「整排图标消失」时，能一眼分清是客户端模块
// 根本没加载（没有这条记录）还是加载了但宿主没渲染到位（有记录、席位也在）。
const diagRaw = storage.get('dsh-quick-chat:diag');
if (!diagRaw) throw new Error('apply 应写入诊断键 dsh-quick-chat:diag');
const diagRecord = JSON.parse(diagRaw);
if (!Array.isArray(diagRecord.seats) || !diagRecord.seats.includes('conversation.session.header.utilities')) {
    throw new Error(`诊断记录应包含已注册席位，实际 ${diagRaw}`);
}
console.log('smoke ok: apply leaves a diagnostic record (load vs render)');

const header = seats.find((s) => s.definition.name === 'conversation.session.header.utilities');
const drawer = seats.find((s) => s.definition.id === 'quick-chat-drawer');

const flatten = (nodes) => nodes.flatMap((n) => (Array.isArray(n) ? flatten(n) : [n]));
function render(node) {
    if (Array.isArray(node)) return node.map(render);
    if (node === null || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
        const props = { ...node.props };
        const kids = flatten(node.children);
        if (kids.length > 0) props.children = kids.length === 1 ? kids[0] : kids;
        return render(node.type(props));
    }
    return { ...node, children: (node.children ?? []).map(render) };
}
const deepFind = (node, predicate) => {
    if (Array.isArray(node)) {
        for (const child of node) {
            const hit = deepFind(child, predicate);
            if (hit) return hit;
        }
        return null;
    }
    if (node === null || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    return deepFind(node.children ?? [], predicate);
};
const byClass = (name) => (n) => n?.props?.className === name;


// --- external: 直接走系统浏览器 -------------------------------------------
const extCtx = {
    slots: { inject: (_n, run) => run(), register: (d, C) => (seats.push({ definition: d, Component: C }), () => {}) },
    sidebarRight: { openTab: () => {} },
};
plugin.apply(extCtx, {
    iconStyle: 'proper',
    sources: [{ id: 'gm', label: 'Gemini', url: 'https://gemini.google.com/app', icon: 'gemini', external: true }],
});
const extHeader = seats[seats.length - 1];
const extProps = extHeader.definition.inject();
if (extProps.sources[0].external !== true) throw new Error('external: true 没有传到源上');
opened.length = 0;
const originalOpen = window.open;
window.open = (url) => opened.push({ via: 'window.open', url });
const extTree = render(extHeader.Component({ ...extProps }));
const extPill = deepFind(extTree, (n) => n?.props?.className === 'dshqc-pill' && typeof n?.props?.onClick === 'function');
extPill.props.onClick();
window.open = originalOpen;
if (!opened.some((o) => o.via === 'window.open' && o.url.includes('gemini.google.com'))) {
    throw new Error(`external 源应调用 window.open，实际 ${JSON.stringify(opened)}`);
}
console.log('smoke ok: external sources open in the system browser');
// Google 登录需要「如实报告」，所以这两个值必须真的不同，且 electron 那份要带 Electron 字样。
seats.length = 0;
slots.length = 0;
const uaCtx = {
    slots: { inject: (_n, run) => run(), register: (d, C) => (seats.push({ definition: d, Component: C }), () => {}) },
    sidebarRight: { openTab: () => {} },
};
plugin.apply(uaCtx, {
    sources: [
        { id: 'ds', label: 'DS', url: 'https://chat.deepseek.com/', icon: 'deepseek' },
        { id: 'gm', label: 'GM', url: 'https://gemini.google.com/app', icon: 'gemini', userAgent: 'electron' },
    ],
});
const uaSources = seats[0].definition.inject().sources;
const chromeUA = uaSources.find((s) => s.id === 'ds').userAgent;
const electronUA = uaSources.find((s) => s.id === 'gm').userAgent;
if (chromeUA === electronUA) throw new Error('userAgent: electron 没有生效，两个源拿到了同一个 UA');
if (!/Electron\//i.test(electronUA)) throw new Error(`electron 源应带 Electron 字样，实际 ${electronUA}`);
if (/Electron\//i.test(chromeUA)) throw new Error('chrome 源不应带 Electron 字样');
console.log('smoke ok: per-source userAgent (chrome vs electron)');
// --- normalization ---------------------------------------------------------
const headerProps = header.definition.inject();
if (headerProps.sources.length !== 2) throw new Error(`invalid sources must drop: got ${headerProps.sources.length}`);
if (headerProps.sources[1].label !== 'chat.deepseek.com') throw new Error('label should fall back to the host');

// --- header click without the desktop bridge ------------------------------
const headerTree = render(header.Component({ ...headerProps }));
const group = deepFind(headerTree, (n) => n?.type === 'div' && n?.props?.role === 'group');
if (flatten(group.children).length !== 2) throw new Error('expected 2 header icons');
flatten(group.children)[0].props.onClick();
const tab = opened.find((o) => o.via === 'openTab');
if (!tab || tab.url !== 'https://kimi.moonshot.cn/') throw new Error(`fallback openTab wrong: ${JSON.stringify(opened)}`);

// --- drawer markup ---------------------------------------------------------
const drawerProps = drawer.definition.inject();
let tree = render(drawer.Component({ ...drawerProps }));
const drawerEl = deepFind(tree, byClass('dshqc-drawer'));
if (!drawerEl) throw new Error('drawer did not render');
if (drawerEl.props['data-open'] !== '0') throw new Error('drawer must start closed');

drawerProps.store.set({ ...drawerProps.store.get(), open: true, active: 'kimi' });
tree = render(drawer.Component({ ...drawerProps }));
const openEl = deepFind(tree, byClass('dshqc-drawer'));
if (openEl.props['data-open'] !== '1') throw new Error('drawer must open when the store says so');

const pillsWrap = deepFind(tree, byClass('dshqc-pills'));
if (!pillsWrap) throw new Error('顶栏缺少厂家按钮容器');
const pills = flatten(pillsWrap.children).filter((n) => n?.props?.className === 'dshqc-pill');
if (pills.length !== 2) throw new Error(`provider bar should list 2 sources, got ${pills.length}`);

// 右侧工具必须固定在工具段里，窄抽屉也不会被挤掉
const toolsNode = deepFind(tree, byClass('dshqc-tools'));
if (!toolsNode) throw new Error('顶栏缺少右侧工具容器');
const toolChildren = flatten(toolsNode.children).map((n) => n?.props?.className).filter(Boolean);
for (const need of ['dshqc-coin-btn', 'dshqc-tint', 'dshqc-external', 'dshqc-refresh', 'dshqc-close']) {
    if (!toolChildren.includes(need)) throw new Error(`工具段缺少 ${need}，实际 ${toolChildren.join(', ')}`);
}
if (toolChildren.includes('dshqc-voice')) throw new Error('正经版不应出现喇叭');
const order = toolChildren.filter((c) => c && c.startsWith('dshqc-'));
if (order[order.length - 1] !== 'dshqc-close') throw new Error('关闭按钮应在最右: ' + order.join(','));
if (order[order.length - 2] !== 'dshqc-refresh') throw new Error('刷新应紧挨关闭: ' + order.join(','));
if (order.includes('dshqc-backdrop')) throw new Error('不应再有遮罩层');
console.log('smoke ok: bar tools pinned (proper: coin / tint / close)');

// Icons are inline glyphs painted with the resolved ink colour (default: gradient).
const glyph = deepFind(pills[0], (n) => n?.type === 'svg');
if (!glyph) throw new Error('provider pill has no svg glyph');
if (deepFind(glyph, (n) => n?.type === 'path' && n?.props?.fill === 'url(#dshqc-ink-grad)') === null) {
    throw new Error('首次安装（无 iconColor 配置）图标应为渐变（url(#dshqc-ink-grad)）');
}
if (!deepFind(glyph, (n) => n?.type === 'linearGradient')) throw new Error('默认渐变缺少 linearGradient 定义');

// No extra chat UI: the site renders its own composer.
for (const forbidden of ['dshqc-input', 'dshqc-send', 'dshqc-zone', 'dshqc-chip']) {
    if (deepFind(tree, byClass(forbidden))) throw new Error(`unexpected extra UI in the drawer: ${forbidden}`);
}

console.log('smoke ok: seats, provider bar, no extra composer, sidebar fallback');

// --- iconStyle: fun -------------------------------------------------------
// 整活版应该渲染内嵌 PNG 头像，而不是单色 glyph；音效为空时点击不能抛错。
seats.length = 0;
slots.length = 0;

const funCtx = {
    slots: {
        inject: (name, run) => (slots.push(name), run()),
        register: (definition, Component) => (seats.push({ definition, Component }), () => {}),
    },
    sidebarRight: { openTab: () => {} },
};

plugin.apply(funCtx, {
    iconStyle: 'fun',
    voiceVolume: 0.5,
    voices: {},
    sources: [
        { id: 'deepseek', label: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'deepseek' },
        { id: 'custom', label: 'Custom', url: 'https://example.com/', icon: 'globe' },
    ],
});

const funHeader = seats.find((s) => s.definition.name === 'conversation.session.header.utilities');
const funProps = funHeader.definition.inject();
if (funProps.store.get().iconStyle !== 'fun') {
    throw new Error(`store 里的初值应为 fun，实际 ${funProps.store.get().iconStyle}`);
}

const funTree = render(funHeader.Component({ ...funProps }));
const funGroup = deepFind(funTree, (n) => n?.type === 'div' && n?.props?.role === 'group');
const funIcons = flatten(funGroup.children);

const avatar = deepFind(funIcons[0], (n) => n?.type === 'img');
if (!avatar) throw new Error('整活版应渲染 img 头像');
if (!/^data:image\/png;base64,/.test(avatar.props.src)) throw new Error('整活版头像必须是内嵌 PNG');
if (avatar.props.className !== 'dshqc-icon dshqc-fun') throw new Error(`头像 class 不对: ${avatar.props.className}`);
if (avatar.props.src.length < 5000) throw new Error('内嵌头像太小，可能没写进去');

// 没有内置整活图的来源要退回 glyph，而不是空白。
const fallbackIcon = deepFind(funIcons[1], (n) => n?.type === 'svg');
if (!fallbackIcon) throw new Error('缺少整活图的来源应退回 svg glyph');

// 点击该厂家的按钮 → 播一次它自己的音频
audioPlayed.length = 0; // 上面的头部点击已经播过一次，这里重新计数
funIcons[0].props.onClick();
if (audioPlayed.length !== 1) throw new Error(`点击应播放 1 段音频，实际 ${audioPlayed.length}`);
if (!/^data:audio\/(mpeg|mp3);base64,/.test(audioPlayed[0].src)) {
    throw new Error(`音频应是内嵌 MP3，实际 ${audioPlayed[0].src.slice(0, 40)}`);
}
if (audioPlayed[0].src.length < 5000) throw new Error('音频 data URI 太小，可能没嵌进去');
if (!(audioPlayed[0].volume > 0 && audioPlayed[0].volume <= 1)) throw new Error('音量应在 0~1');
console.log('smoke ok: iconStyle=fun renders embedded avatars');

// 再点同一个按钮 → 再播一次（每次点击各放一遍）
funIcons[0].props.onClick();
if (audioPlayed.length !== 2) throw new Error(`第二次点击应再播一段，实际 ${audioPlayed.length}`);
// 换一个没有内置音效的来源 → 不能抛错
funIcons[1].props.onClick();
console.log('smoke ok: each click plays its own clip once');

// --- 抽屉顶栏：色点只属于正经版，喇叭只属于整活版 -------------------------
const funDrawer = seats.find((s) => s.definition.id === 'quick-chat-drawer');
const drawerProps2 = funDrawer.definition.inject();
const renderDrawer = () => render(funDrawer.Component({ ...drawerProps2 }));
const toolsOf = (tree) =>
    flatten(deepFind(tree, (n) => n?.props?.className === 'dshqc-tools')?.children ?? [])
        .map((n) => n?.props?.className)
        .filter(Boolean);

drawerProps2.store.set({ ...drawerProps2.store.get(), open: true, iconStyle: 'proper' });
let topTree = renderDrawer();
let tools = toolsOf(topTree);

if (!tools.includes('dshqc-coin-btn')) throw new Error('顶栏缺少硬币按钮');
if (!tools.includes('dshqc-tint')) throw new Error('正经版应显示色点');
if (tools.includes('dshqc-voice')) throw new Error('正经版不应显示喇叭');
if (!tools.includes('dshqc-close')) throw new Error('顶栏缺少关闭按钮');

// 正经版点击厂家按钮：不出声
audioPlayed.length = 0;
deepFind(topTree, (n) => n?.props?.className === 'dshqc-pill').props.onClick();
if (audioPlayed.length !== 0) throw new Error('正经版点击不应出声');
console.log('smoke ok: proper mode hides the speaker and stays silent');

// 硬币两面都在
const coinBtn = deepFind(topTree, (n) => n?.props?.className === 'dshqc-coin-btn');
const faces = [];
const collect = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(collect);
    if (node.props?.className?.includes('dshqc-coin-face')) faces.push(node.props.className);
    (node.children ?? []).forEach(collect);
};
collect(coinBtn);
if (faces.length !== 2) throw new Error(`硬币应有正反两面，实际 ${faces.length}`);
if (!faces.some((c) => c.includes('front')) || !faces.some((c) => c.includes('back'))) {
    throw new Error('硬币正反面 class 不全');
}

// 翻到整活版：色点消失，喇叭出现
coinBtn.props.onClick();
if (drawerProps2.store.get().iconStyle !== 'fun') {
    throw new Error(`点击硬币后应切到 fun，实际 ${drawerProps2.store.get().iconStyle}`);
}
topTree = renderDrawer();
tools = toolsOf(topTree);
if (tools.includes('dshqc-tint')) throw new Error('整活版不应显示色点');
if (!tools.includes('dshqc-voice')) throw new Error('整活版应显示喇叭');
console.log('smoke ok: coin flips and swaps the colour dot for the speaker');

// 整活版点击厂家按钮：出声；关掉喇叭后静音
audioPlayed.length = 0;
deepFind(topTree, (n) => n?.props?.className === 'dshqc-pill').props.onClick();
if (audioPlayed.length !== 1) throw new Error(`整活版点击应出声，实际 ${audioPlayed.length}`);

const voiceBtn = deepFind(topTree, (n) => n?.props?.className === 'dshqc-voice');
if (voiceBtn.props['data-on'] !== '1') throw new Error('音效开关默认应为开');
voiceBtn.props.onClick();
if (drawerProps2.store.get().voiceOn !== false) throw new Error('点击后应关闭音效');
audioPlayed.length = 0;
deepFind(renderDrawer(), (n) => n?.props?.className === 'dshqc-pill').props.onClick();
if (audioPlayed.length !== 0) throw new Error('静音时点击不应出声');
console.log('smoke ok: voice switch mutes and unmutes');

// 色点循环（回到正经版才显示）
drawerProps2.store.set({ ...drawerProps2.store.get(), iconStyle: 'proper' });
const tintTree = renderDrawer();
const tintBtn = deepFind(tintTree, (n) => n?.props?.className === 'dshqc-tint');
if (!tintBtn) throw new Error('正经版缺少色点');
const startTint = tintBtn.props['data-tint'];
tintBtn.props.onClick();
if (drawerProps2.store.get().iconColor === startTint) throw new Error('点击色点应换到下一档');
console.log('smoke ok: tint cycles white → blue → black → auto → grad');

// 渐变色是第 5 档
drawerProps2.store.set({ ...drawerProps2.store.get(), iconColor: 'grad' });
const gradTree = renderDrawer();
if (!deepFind(gradTree, (n) => n?.type === 'path' && String(n?.props?.fill ?? '').startsWith('url(#'))) {
    throw new Error('渐变色应把 path 填成 url(#…)');
}
if (!deepFind(gradTree, (n) => n?.type === 'linearGradient')) throw new Error('渐变色缺少 linearGradient 定义');
console.log('smoke ok: gradient tint paints glyphs with a linearGradient');

// 左缘拖拽条
const resizer = deepFind(tintTree, (n) => n?.props?.className === 'dshqc-resizer');
if (!resizer) throw new Error('抽屉缺少拖拽改变宽度的把手');
if (typeof resizer.props.onPointerDown !== 'function') throw new Error('拖拽把手缺少指针事件');
console.log('smoke ok: drawer has a drag handle');


// --- iconStyle: proper（默认） + iconColor 生效 ----------------------------
if (headerProps.store.get().iconStyle !== 'proper') {
    throw new Error(`默认应为 proper，实际 ${headerProps.store.get().iconStyle}`);
}
if (headerProps.store.get().iconColor !== 'grad') {
    throw new Error(`默认颜色应为 grad，实际 ${headerProps.store.get().iconColor}`);
}

// 换成蓝色配置，glyph 必须用蓝色描边
// （先清掉界面上切换过的本地记忆，否则 localStorage 里的旧值会盖过配置）
storage.clear();
seats.length = 0;
slots.length = 0;
plugin.apply(funCtx, {
    iconStyle: 'proper',
    iconColor: 'blue',
    sources: [{ id: 'deepseek', label: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'deepseek' }],
});
const blueHeader = seats.find((s) => s.definition.name === 'conversation.session.header.utilities');
const blueProps = blueHeader.definition.inject();
const blueTree = render(blueHeader.Component({ ...blueProps }));
if (deepFind(blueTree, (n) => n?.type === 'path' && n?.props?.fill === '#2f6bff') === null) {
    throw new Error('iconColor=blue 时图标应为蓝色');
}
console.log('smoke ok: iconColor=blue paints the glyphs blue');

// --- 守卫：头部那组「在 DOM 里但看不见」时自己补位 -------------------------
// 用户报告：点「收起侧边栏」后三个图标没了，重启也不回来。重排后宿主的席位可能
// 还连着 DOM，却 0 宽 / 被祖先隐藏 / 被整体推出视口。旧守卫只看「元素在不在」，
// 所以永远不接管 —— 这三条路径现在都要能自愈。
{
    const guardSeat = seats.find((s) => s.definition.id === 'quick-chat-guard');
    if (!guardSeat) throw new Error('守卫席位（shell.overlay / quick-chat-guard）没注册');
    const guardProps = guardSeat.definition.inject();
    const ANCHOR = { top: 20, bottom: 52, left: 900, right: 1020, width: 120, height: 32 };
    const el = (rect, extra = {}) => ({
        isConnected: true,
        getBoundingClientRect: () => rect,
        checkVisibility: () => true,
        closest: () => null,
        ...extra,
    });

    // 让守卫真的跑起来：带状态的 useState + 会执行的 useEffect + 可控的 setInterval
    const mountGuard = (groups) => {
        const states = [];
        const effects = [];
        const probes = [];
        let cursor = 0;
        const useState = (initial) => {
            const slot = cursor++;
            if (!(slot in states)) states[slot] = initial;
            return [
                states[slot],
                (next) => {
                    states[slot] = typeof next === 'function' ? next(states[slot]) : next;
                },
            ];
        };
        React.useState = useState;
        React.useEffect = (fn) => {
            effects[cursor++] = fn;
        };
        sandbox.setInterval = (fn) => (probes.push(fn), probes.length);
        sandbox.clearInterval = () => {};
        sandbox.window.innerWidth = 1200;
        sandbox.window.innerHeight = 800;
        sandbox.document.querySelectorAll = (selector) => (selector === '.dshqc-header-group' ? groups : []);
        sandbox.document.querySelector = (selector) =>
            selector === '[data-conversation-header-corner]' ? el(ANCHOR) : null;
        const rerender = () => {
            cursor = 0;
            return guardSeat.Component(guardProps);
        };
        rerender();
        for (const fn of effects) if (typeof fn === 'function') fn();
        return { probes, rerender };
    };

    const guardBox = (tree) => deepFind(render(tree), (n) => n?.props?.className === 'dshqc-header-guard');
    const pillsOf = (tree) => {
        const found = [];
        const walk = (node) => {
            if (Array.isArray(node)) return node.forEach(walk);
            if (node === null || typeof node !== 'object') return;
            if (node.props?.className === 'dshqc-pill') found.push(node);
            walk(node.children ?? []);
        };
        walk(render(tree));
        return found;
    };

    // A) 席位还在，但盒子是 0（宿主重挂 / 祖先 display:none 的典型形态）
    //    挂载时 effect 自己先探一次；连续两次探不到才接管，所以首帧不会闪。
    const a = mountGuard([el({ ...ANCHOR, width: 0, height: 0, left: 900, right: 900, top: 20, bottom: 20 })]);
    if (guardBox(a.rerender()) !== null) throw new Error('只探到一次就接管，首帧会闪出一个重复按钮');
    a.probes[0]();
    const aTree = a.rerender();
    const aBox = guardBox(aTree);
    if (aBox === null) throw new Error('席位在 DOM 里但 0 宽时，守卫应补位');
    if (pillsOf(aTree).length !== guardProps.sources.length) {
        throw new Error(`守卫应补 ${guardProps.sources.length} 个按钮，实际 ${pillsOf(aTree).length}`);
    }
    if (aBox.props.style.zIndex !== 60) throw new Error('守卫层级必须高于抽屉（31）');
    console.log('smoke ok: guard takes over when the header seat is in the DOM but invisible');

    // B) 席位可见：守卫必须让开
    const b = mountGuard([el(ANCHOR)]);
    b.probes[0]();
    if (guardBox(b.rerender()) !== null) throw new Error('头部可见时不该补位（会出现两排图标）');
    console.log('smoke ok: guard stays out of the way while the header seat is visible');

    // C) 席位被整体推出视口（主栏被 translateX 推走时就是这种形态）
    const c = mountGuard([el({ top: 20, bottom: 52, left: -1400, right: -900, width: 500, height: 32 })]);
    c.probes[0]();
    c.probes[0]();
    if (guardBox(c.rerender()) === null) throw new Error('席位被推出视口时，守卫应补位');
    console.log('smoke ok: guard takes over when the header seat is pushed off-screen');

    // D) 席位先不可见、后恢复：守卫接管后必须自己撤掉
    const groups = [el({ top: 20, bottom: 20, left: 900, right: 900, width: 0, height: 0 })];
    const d = mountGuard(groups);
    d.probes[0]();
    d.probes[0]();
    if (guardBox(d.rerender()) === null) throw new Error('席位不可见时守卫应先接管');
    groups.length = 0;
    groups.push(el(ANCHOR)); // 宿主重新挂回可见的席位
    d.probes[0]();
    if (guardBox(d.rerender()) !== null) throw new Error('席位恢复可见后守卫应立刻撤掉');
    console.log('smoke ok: guard retracts once the header seat is back');
}

// --- 图标颜色：选项随底色收敛，白色保留对比度兜底 --------------------------
// 浅色底不提供白色（白字 + #EDF2FA 头部 = 1.12:1，等于隐形），深色底不提供黑色；
// 其余颜色按用户所选原样绘制，只有白色在量到浅底时会被翻成深色（皮肤可能把
// 深色主题的头部刷成浅色，这条兜底就是给那种情况留的）。
{
    const ctxStub = {
        slots: { inject: (_n, run) => run(), register: (d, C) => (seats.push({ definition: d, Component: C }), () => {}) },
        sidebarRight: { openTab: () => {} },
    };
    const headerFor = (iconColor) => {
        storage.clear();
        seats.length = 0;
        slots.length = 0;
        plugin.apply(ctxStub, {
            iconStyle: 'proper',
            iconColor,
            sources: [{ id: 'deepseek', label: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'deepseek' }],
        });
        const seat = seats.find((s) => s.definition.name === 'conversation.session.header.utilities');
        if (!seat) throw new Error('缺 header 席位');
        return seat.definition.inject();
    };

    // 浅色主题（body 上没有 data-ds-dark-theme）：配置里的 white 这一档不存在，退回默认渐变
    const whiteOnLight = headerFor('white');
    if (whiteOnLight.store.get().iconColor !== 'grad') {
        throw new Error(`浅色主题下 white 应退回 grad，实际 ${whiteOnLight.store.get().iconColor}`);
    }
    console.log('smoke ok: white is not offered on a light theme, the config falls back to the default');

    // 纯函数：白色的对比度兜底仍然在
    const { contrastInk } = plugin.internals;
    if (contrastInk('#ffffff', { r: 237, g: 242, b: 250, a: 1 }) !== '#111317') {
        throw new Error('白色落在浅色底上应翻成深色');
    }
    if (contrastInk('#ffffff', { r: 21, g: 21, b: 23, a: 1 }) !== '#ffffff') {
        throw new Error('白色落在深色底上应保留');
    }
    if (contrastInk('#2f6bff', { r: 237, g: 242, b: 250, a: 1 }) !== '#2f6bff') {
        throw new Error('蓝色不该被兜底改色');
    }
    if (contrastInk('url(#dshqc-ink-grad)', { r: 21, g: 21, b: 23, a: 1 }) !== 'url(#dshqc-ink-grad)') {
        throw new Error('渐变不该被兜底改色');
    }
    console.log('smoke ok: contrast fallback still guards white, and leaves blue / gradient alone');

    // 浅色主题下黑色是合法选项，画出来就是黑色
    const blackOnLight = headerFor('black');
    if (blackOnLight.store.get().iconColor !== 'black') {
        throw new Error(`浅色主题下 black 应保留，实际 ${blackOnLight.store.get().iconColor}`);
    }
    const blackSeat = seats.find((s) => s.definition.name === 'conversation.session.header.utilities');
    const blackElement = blackSeat.Component({ ...blackSeat.definition.inject() });
    const blackSvg = deepFind(render(blackElement), (n) => n?.props?.className === 'dshqc-glyph');
    const blackFill = deepFind(blackSvg, (n) => n?.type === 'path')?.props?.fill ?? null;
    if (blackFill !== '#111317') {
        throw new Error(`黑色档应画成 #111317，实际 ${String(blackFill)}`);
    }
    console.log('smoke ok: black stays black wherever it is offered');
}

// --- 打开抽屉时主界面要让位 ------------------------------------------------
// 抽屉是浮层，宿主不会替它让轨道：插件把中栏的右边距设成
// 「抽屉宽度 − 第三列（宿主右栏已占）」。这里锁死这个算式。
{
    const { pushMarginFor } = plugin.internals;
    if (typeof pushMarginFor !== 'function') throw new Error('缺 pushMarginFor');
    const cases = [
        ['280px 1160px 0px', 680, 680], // 右栏关着：整条让
        ['280px 760px 480px', 680, 200], // 右栏已占 480：只补差
        ['280px 1440px 0px', 200, 200], // 很窄的抽屉也让
        ['280px 620px 680px', 680, 0], // 右栏比抽屉还宽：不再让
        ['0px 1000px 0px', 520, 520], // 侧栏收起
    ];
    for (const [tracks, width, want] of cases) {
        const got = pushMarginFor(tracks, width);
        if (got !== want) throw new Error(`pushMarginFor(${tracks}, ${width}) 应为 ${want}，实际 ${got}`);
    }
    console.log('smoke ok: drawer reserves exactly the width the host has not already reserved');
}

// --- CloudFront 403 认领 -----------------------------------------------------
// 被拦的页面是「加载成功」的，只能靠标题/正文认出来，好提示用户多半是代理出口 IP。
{
    const { isCloudFrontBlock } = plugin.internals;
    if (typeof isCloudFrontBlock !== 'function') throw new Error('缺 isCloudFrontBlock');
    const title = 'ERROR: The request could not be satisfied';
    const body =
        '403 ERROR\nThe request could not be satisfied.\nRequest blocked.\nWe can not connect to the server ... Generated by cloudfront (CloudFront)';
    if (!isCloudFrontBlock(title, body)) throw new Error('没认出 CloudFront 的 403 页');
    if (!isCloudFrontBlock('', body)) throw new Error('标题为空时也应该靠正文认出来');
    if (isCloudFrontBlock('DeepSeek', 'Welcome back')) throw new Error('正常页面被误判成 403');
    if (isCloudFrontBlock('The request could not be satisfied', 'your own error page')) {
        throw new Error('只有 CloudFront 特征齐全时才算 403');
    }
    if (plugin.internals.text.blocked.includes('403') === false) throw new Error('中文提示里应说明 403');
    console.log('smoke ok: CloudFront 403 pages are recognised, ordinary pages are not');
}

// --- 选项随底色收敛 ---------------------------------------------------------
// 浅色底不提供白色、深色底不提供黑色：少一个看不见的选项，也就没有「选了被改色」。
{
    const { availableTints, nextTint } = plugin.internals;
    if (typeof availableTints !== 'function' || typeof nextTint !== 'function') {
        throw new Error('缺 availableTints / nextTint');
    }
    const light = availableTints(false);
    const dark = availableTints(true);
    if (light.includes('white')) throw new Error(`浅色底不该提供白色，实际 ${light.join(',')}`);
    if (!light.includes('black')) throw new Error(`浅色底应提供黑色，实际 ${light.join(',')}`);
    if (dark.includes('black')) throw new Error(`深色底不该提供黑色，实际 ${dark.join(',')}`);
    if (!dark.includes('white')) throw new Error(`深色底应提供白色，实际 ${dark.join(',')}`);
    if (light.length !== 4 || dark.length !== 4) throw new Error(`两档底色后应各剩 4 个选项，实际 ${light.length}/${dark.length}`);
    if (nextTint('blue', false) !== 'black') throw new Error(`浅色底 blue 之后应为 black，实际 ${nextTint('blue', false)}`);
    if (nextTint('grad', true) !== 'white') throw new Error(`深色底 grad 之后应回到 white，实际 ${nextTint('grad', true)}`);
    if (nextTint('black', false) !== 'auto') throw new Error(`浅色底 black 之后应为 auto，实际 ${nextTint('black', false)}`);
    if (nextTint('white', true) !== 'blue') throw new Error(`深色底 white 之后应为 blue，实际 ${nextTint('white', true)}`);
    console.log('smoke ok: the tint cycle drops whichever option is invisible on this background');
}

// --- 界面文案跟系统语言走 ---------------------------------------------------
// 英文用户不该在文案里看到中文；中文环境仍用中文。
{
    if (plugin.internals.lang !== 'en') throw new Error(`无语言偏好时应退回英文，实际 ${plugin.internals.lang}`);
    if (plugin.internals.text.close !== 'Close') throw new Error(`英文文案不生效：${plugin.internals.text.close}`);
    if (plugin.internals.text.tintTitle('White') !== 'Icon colour: White (click to cycle)') {
        throw new Error('英文色点提示不对');
    }

    const mini = [];
    const miniWindow = {
        addEventListener: () => {},
        removeEventListener: () => {},
        __ModuleLoader__: { load: (module) => mini.push(module) },
    };
    const miniSandbox = {
        window: miniWindow,
        navigator: { userAgent: 'test', language: 'zh-CN' },
        document: { querySelector: () => null },
        console: { log: () => {}, warn: () => {}, error: console.error },
        URL,
        require: (name) => {
            if (name === 'react') return React;
            throw new Error(`unexpected module request: ${name}`);
        },
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
    };
    miniSandbox.globalThis = miniSandbox;
    vm.createContext(miniSandbox);
    vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), miniSandbox, { filename: SOURCE });
    const zhPlugin = mini[0].factory(miniSandbox.require);
    if (zhPlugin.internals.lang !== 'zh') throw new Error(`zh-CN 应选中中文，实际 ${zhPlugin.internals.lang}`);
    if (zhPlugin.internals.text.close !== '关闭') throw new Error(`中文文案不生效：${zhPlugin.internals.text.close}`);
    console.log('smoke ok: UI text follows the system language (zh / en)');
}

console.log('sources:', headerProps.sources.map((s) => s.id).join(', '));







