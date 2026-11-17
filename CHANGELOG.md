# 变更记录

## 1.27.0 — 2026-11-16

这一版补齐发布与上架配置，另外修了两件用户会直接撞上的事：被系统代理挡住时只看得到一张 403 错误页，以及首图画着一个插件里根本不存在的「切换」按钮。

### 新增

- **CloudFront 403 认领**：每次加载结束读回 guest 的标题与正文，认出 CloudFront 的 `Request blocked` 页就在抽屉里直接给出「多半是系统代理的出口 IP 被限」的处理办法（中英双语），不用再对着错误页猜。
- **`tools/redraw-toolbar.py`**：首图右侧工具栏的重绘脚本——擦掉旧控件、按真实控件重画，路径相对仓库，可重复执行。

- **`test/package.mjs`（11 项打包自检）**：包名 / Loader 行名 / 客户端模块 id 三者一致；`dsh.bundle` 与 `engines.dsh` 在位；`locale` 里 `meta.detail` 指向的文档与配图真的在包里；图标是有效 PNG 且不超 256 KiB；`screenshots.json` 路径合法且不指向仓库外；`files` 既覆盖运行时文件又不夹带 `test/` `tools/` `assets/`；版本号在 `package.json`、`CHANGELOG.md`、README 徽章三处一致；参考配置里的站点地址是 http(s)；上架条目里的 `url` / `name` / 分类 / 图标 / 预构建包地址都对得上。`npm test` 现在同时跑功能与打包两套断言。
- **`tools/pack.mjs`**：用 `npm pack` 出 Release 附件，附带不带版本号的别名 `dsh-quick-chat.tgz`（给 `releases/latest/download` 用）和 `SHA256SUMS.txt`；`--dry-run` 只打印并校验文件清单。
- **`.github/workflows/ci.yml`**：Node 22.19 与 24 双版本跑测试与打包校验，无需安装依赖。
- **`.github/workflows/release.yml`**：推 `v*` tag 时自动校验 tag 与 `package.json` 版本一致、跑测试、出包、从 `CHANGELOG.md` 摘出正文、创建 Release 并挂附件。
- **`screenshots.json`**：市场卡片用的 4 张截图（会话头部、拖宽、两套图标、硬币）。
- **`market/lrhero__dsh-quick-chat.yml`**：上架 `awesome-dsh-plugin` 用的条目，含分类、中英描述、图标与预构建包地址。
- **`docs/PUBLISHING.md`**：发布手册——话题、发版、上架、npm 可选项、验证清单、常见被拒原因。
- **`tools/relabel-figure.py`**：README 首图 `docs/hero-drawer.png` 的文案重绘脚本——擦掉旧标签，按原字体、字号、颜色重画，路径相对仓库，可重复执行。

### 变更

- **`package.json` 打包字段重写**：`files` 只带运行时与元数据（`index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`docs/DETAIL*.md`、`docs/preview.svg`、`icon.png`、`screenshots.json`、README/LICENSE/CHANGELOG），不再把 `test/`、`tools/`、`assets/` 和 README 配图（约 1.4 MiB 源图与音效）塞进安装包；`exports` 补 `./icon`；描述改成一句可复用的英文短句；`keywords` 补 `dsh-client-plugin` 与 `panel`。
- **移除非标准的 `dshWorkshop` 段**：那是另一个市场私有的清单格式，`evidence` 全为 `null`，留着只会让别的市场读到一堆没验证过的声明。
- **安装章节只留两条路**：删掉「装成本地插件目录」与「设置 → 插件 → 添加本地插件」两段手装流程，以及卸载里对应的手动清理说明——预构建包、仓库、插件市场三条已经覆盖所有情况。
- **署名改为 `lrhero`**：README 许可行、`LICENSE`、`package.json` 的 `author` 不再写真实姓名与邮箱。
- **示意图改用 A / B 命名**：首图左侧标签 `正经版` / `整活版` → `A 版` / `B 版`，README 正文与 `cordis.patch.yml` 注释同步改用 A 版 / B 版，配置值仍是 `proper` / `fun`。
- **首图重画成真实工具栏**：首图删掉那个并不存在的「切换」文字按钮和自造的 `chat.deepseek.com` 地址，改成插件真正的控件——硬币（A 版冠面 / B 版带电面）+ 配色点（A 版）/ 喇叭（B 版）+ 分隔线 + ↗ ⟳ ×；底部说明随之改成「橙圈 = 硬币开关」。
- **首次安装默认图标颜色改为渐变（蓝→青）**：原来代码与参考配置的默认都是 `white`，只在对比度低于 2.2 时才自动翻成深色 / 白色（`contrastInk`），并没有「首次安装按系统背景选黑 / 白」这条规则。现在没有配置也没有本地记忆时用 `grad`；`white` / `black` / `blue` / `auto` 仍可通过配置或抽屉里的色点切换。
- **`docs/icon-sets.png` 同步改名**：`A · 正经版` → `A · 矢量图标`，`B · 整活版` → `B · 插画头像`，与正文的 A 版 / B 版对齐。
- **首图文件改名为 `docs/hero-drawer.png`**：README、`screenshots.json` 与两个重绘脚本同步更新。旧名 `docs/bar.png` 不再使用——同名旧文件容易被预览器缓存成上一版，换一个文件名可以彻底绕开。
- **市场截图去掉过期的那张**：`drawer-width.png` 是旧版顶栏（右侧还有一个文字项），已从 `screenshots.json` 移除，现在只展示 `bar` / `icon-sets` / `coin` 三张。
- **描述里的配色数量校正**：`locale` 中英与市场条目原来写「五种配色 / five colour schemes」，实际是随底色收敛的四种（默认渐变），已改。
- **README 安装说明标明 npm 同名包不是本项目**：`dsh-quick-chat` 在 npm 上已被别人占用，安装只走 GitHub 预构建包 / 仓库两条命令，避免有人 `dsh plugin add dsh-quick-chat` 装错。
- **README 补 403 排查**：已知限制写清「guest 跟随系统代理」，排查一节给出直连 / 走代理两条 `curl` 命令和一张判定表。

### 修复

- **颜色档位随底色收敛**：色点现在只轮换当前底色看得见的那几档——浅色底不出现「白」、深色底不出现「黑」，5 档变 4 档。配置或本地记忆里如果存着不可见的那一档，启动时退回默认渐变，不会再一进来就是隐形图标。
- **深色底上选「深色（黑）」不再被翻成白色**：对比度兜底原来对每一档都生效，`black` 落在深色头部上会被强制改成 `#ffffff`，于是「黑」和「白」两档看起来完全一样。现在兜底只作用于 `white`（皮肤把头部刷成浅色时仍然能救回来）；`black` / `blue` / `grad` 严格保持所选颜色。
- **被 CloudFront 拒绝时给出可操作提示**：原来只有一张 `403 ERROR / Request blocked`，现在面板直接说明原因与改法。

### 验证

- `node test/smoke.mjs` → 25 项断言全绿
- `node test/package.mjs` → 11 项断言全绿
- `node tools/pack.mjs --dry-run` → tarball 文件清单正确

## 1.26.0 — 2026-11-16

### 新增

- **界面中英双语**：文案跟随系统语言（`zh*` 用中文，其余用英文）。以前英文用户会看到「点击翻面」「刷新当前页面」这类中文标题，而 README 又是英文的。
- 头部厂家按钮补 `aria-pressed`，屏幕阅读器能读出当前打开的是哪一家。

### 变更

- **诊断默认只记事件**（`apply` / `header-mount` / `guard-takeover` / `push`），完整几何快照改为开关触发：控制台执行 `localStorage.setItem('dsh-quick-chat:debug','1')` 后刷新。之前每次启动固定写 3 条快照，长期下来是没有用的垃圾数据。

### 验证

- `node test/smoke.mjs` → 22 项断言全绿（新增中英文案断言两条路径）

## 1.25.0 — 2026-11-14

### 修复

- **打开抽屉时主界面正确让位**：之前给 `documentElement` 设 `--dsh-sidebar-width` 是无效的——那个变量是宿主右栏面板自己的内联变量，只驱动它内部 dock 的 `translateX`，不参与主内容布局。现在改为找到框架的三列网格（`sidebar | center | rightbar`），把中栏的 `margin-right` 设成「抽屉实测宽度 − 第三列宽度」，宿主右栏已占的部分不重复让。拖动改宽、窗口缩放、右栏开合都会重算，另有 1 秒低频复核，关闭时立刻还原。

### 新增

- 抽屉宽度用实测值（`getBoundingClientRect`），不再依赖可能为空的 `state.width`
- `localStorage['dsh-quick-chat:diag']` 增加 `push` 事件，记录让位量与抽屉宽度
- README 重写（中文 + 英文），补安装、配置、隐私、排查章节；新增 MIT 许可证、变更记录、插件管理器用的 `locale/` 元数据与详情页示意图

### 发布准备

- 按社区插件惯例声明 `engines.dsh: >=0.2.2-0 <0.3.0`（插件市场据此判断兼容性），并补齐 `repository` / `homepage` / `bugs` / `author`
- README 顶部加中英切换与许可证/版本徽章；安装章节以 `dsh plugin --profile <profile> add github:…` 开头，本地目录与插件管理器两条路留作备选

## 1.24.0 — 2026-11-14

### 修复

- **图标在浅色头部上隐形**：`parseColor` 只认 `rgb()`，墨色是 `#RRGGBB` 所以对比度自适应从未生效。现在两种格式都认。
- **配色自适应反向回归**：只测一次就锁死颜色，会把白色翻成黑色、落在深色底上又变成黑底黑字。改为挂载后 0.3s / 1.2s 各补量一次 + 3 秒复核；守卫补位那组固定深底白字，不参与自适应。
- 守卫补位组的底片改为固定深色，不再跟随主题 token。

### 新增

- 诊断记录增加 `theme` / `corner` / `groups[].hit` / `tabs` / `panes` 等实测字段
- `header-mount` 探针：区分「席位没被宿主渲染」与「渲染了但看不见」

## 1.23.0 — 2026-11-14

### 修复

- **守卫判断条件错误**：原来只看 `.dshqc-header-group` 在不在 DOM 里。宿主重排头部后按钮可能还在 DOM 却整段不可见（0 宽、祖先 `display:none`、被裁切、被推出视口），守卫于是永远不接管。现在按「真的画出来了吗」判定：盒子尺寸 + `checkVisibility()` + 视口相交 + 祖先 `overflow` 裁切 + `elementFromPoint` 落点。
- 守卫的副本会被自己误判成「头部还在」，导致每秒闪一次；现在排除自身子树。
- `inject` 去掉 `sidebarRight`：宿主一旦不提供该服务，整个插件会静默不激活。

### 新增

- `localStorage['dsh-quick-chat:diag']` 诊断记录

## 1.0.0 — 首个可用版本

- 会话头部一排厂家头像，点击从右侧滑出该厂家自己的网页版聊天
- 自建 webview + 桌面 Chrome UA，绕开 DeepSeek 的「使用环境异常」检测
- 两套图标（矢量 / 插画）、五种配色、硬币翻面、每家点击音效、可拖拽宽度
