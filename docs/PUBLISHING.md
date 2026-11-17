# 发布手册

这份文档只讲一件事：**怎样让别人搜得到、装得上 `dsh-quick-chat`。**

社区目前有三个入口，它们互相独立，可以只做其中一部分：

| 入口 | 别人怎么进来 | 需要做什么 |
|---|---|---|
| GitHub 话题 | 搜 [github.com/topics/dsh-plugin](https://github.com/topics/dsh-plugin) 翻到你的仓库 | 仓库是公开的、带 `dsh-plugin` topic、`package.json` 里有 `dsh.bundle` |
| 插件市场（Discover 页签 / 设置 → 插件市场） | 在市场里搜到卡片，点一下装好 | 往 `awesome-dsh-plugin` 提一个 YAML 文件的 PR（下面有现成文件） |
| npm | `dsh plugin add <包名>`、npm 搜索、市场里显示下载量 | 发布一个**没被占用**的包名（见最后一节） |

只要仓库里有 `package.json` 的 `dsh.bundle.patch`，任何一条入口装出来的效果都一样。**这个插件零依赖、无构建脚本，从源码装和从 tarball 装没有区别**，所以 npm 是可选项，不做也不影响上架。

---

## 一、一次性设置（只做一次）

### 1. 仓库 About

打开 <https://github.com/lrhero/dsh-quick-chat>，点右上角齿轮：

- **Description**：`DeepSeek Harness 插件：会话头部一排厂家头像，点一下从右侧滑出 DeepSeek / 豆包 / Gemini 自己的网页版聊天`
- **Website**：留空或填 `https://github.com/lrhero/dsh-quick-chat#readme`
- **Topics**：`dsh-plugin`、`deepseek-harness`、`dsh`、`cordis`、`webview`

`dsh-plugin` 是硬性要求——没有它，话题页搜不到，社区发现机器人也扫不到。

也可以直接用命令加（把 `TOKEN` 换成你的 PAT，勾选 `repo` 权限即可）：

```powershell
$headers = @{ Authorization = "Bearer TOKEN"; Accept = "application/vnd.github+json" }
$body = @{
  description = "DeepSeek Harness 插件：会话头部一排厂家头像，点一下从右侧滑出 DeepSeek / 豆包 / Gemini 自己的网页版聊天"
  topics      = @("dsh-plugin", "deepseek-harness", "dsh", "cordis", "webview")
} | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/lrhero/dsh-quick-chat" -Headers $headers -Body $body
```

### 2. 确认默认分支叫 `main`

README、市场条目和 `raw.githubusercontent.com` 的图标地址都写死了 `main`。改名的话这三处要一起改。

---

## 二、每次发版（5 步）

```powershell
# 1. 改版本号：package.json 的 version、CHANGELOG.md 顶部新增一节、README 徽章
#    test/package.mjs 会检查这三处是否一致

# 2. 本地先跑一遍（不需要 DSH、不需要网络）
npm test
npm run pack:check

# 3. 提交
git add -A
git commit -m "release: 1.27.0"
git push origin main

# 4. 打 tag 并推送 —— 这一步会触发 .github/workflows/release.yml
git tag v1.27.0
git push origin v1.27.0
```

第 5 步由 CI 完成：跑测试 → 用 `npm pack` 出 tarball → 从 `CHANGELOG.md` 摘出这一版正文 → 创建 GitHub Release 并挂上三个附件。

| 附件 | 用途 |
|---|---|
| `dsh-quick-chat-1.27.0.tgz` | 固定在版本上的安装包 |
| `dsh-quick-chat.tgz` | 同内容，但地址里不带版本号，`releases/latest/download/dsh-quick-chat.tgz` 永远指向最新版 |
| `SHA256SUMS.txt` | 校验和 |

发完之后验证一下：

```powershell
# 应该 200，并且 Content-Length 不为 0
Invoke-WebRequest -Method Head "https://github.com/lrhero/dsh-quick-chat/releases/latest/download/dsh-quick-chat.tgz"
```

tag 和 `package.json` 版本对不上时 workflow 会直接失败，不会发出一个版本号错误的 Release。

---

## 三、上架插件市场

市场（`dshmarket` 插件、Discover 页签、`plugin_market` 智能体工具）的目录来自精选列表 `awesome-dsh-plugin`。**它不是这个仓库，也不是 npm**——上架就是把一个 YAML 文件加进那个列表。

1. 打开 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>，fork。
2. 把本仓库的 `market/lrhero__dsh-quick-chat.yml` 复制成 `data/plugins/lrhero__dsh-quick-chat.yml`（文件名就是 `所有者__仓库名`）。
3. 提交 PR，只加这一个文件。

文件里每个字段的含义：

| 字段 | 说明 |
|---|---|
| `url` / `name` | 必须和仓库完全一致（`https://github.com/lrhero/dsh-quick-chat` / `lrhero/dsh-quick-chat`） |
| `category` | `ui`（界面增强）。可选值见 contributing.md，别为了曝光乱选，分类不对维护者会直接改 |
| `description.en` | 必填，一句话，与代码一致，不夸大 |
| `description.zh` | 可留空，维护者会补 |
| `icon` | 必须是 GitHub 托管的 png/jpg/webp（这里用仓库根目录的 512×512 `icon.png`），SVG 和第三方图床会被拒 |
| `tarball` | 可选。指向 Release 里的预构建包，市场会优先给这条安装地址 |

CI 会检查：`dsh.bundle` 是否存在、仓库是否已创建满 1 天、YAML 格式、README 能否由数据重新生成。**人工审查会读代码**，核对描述里的每个数字和 API 名——所以描述里不要写没做的功能。

关于 `tarball`：这里用的是 `releases/latest/download/dsh-quick-chat.tgz`，好处是每次发版不用再动条目；列表里也有维护者习惯把地址钉死在某个 tag 上（`releases/download/v1.27.0/dsh-quick-chat-1.27.0.tgz`），如果审查时被要求固定版本，改这一行即可。

合并后：站点与市场目录在当天或次日重新生成，市场里就能搜到 `Quick Chat`。之后改描述、换分类，只要改自己那一行 YAML 再提 PR。

预览图不用提 PR：市场会读仓库根目录的 `screenshots.json`（最多 8 张）。改图后直接推仓库即可。

### 已经提交过之后

- 改描述 / 分类：改 `data/plugins/lrhero__dsh-quick-chat.yml`，**只改自己那一条**。
- 换截图：改 `screenshots.json` 或图片文件，推仓库。
- 仓库长期不更新会被定期扫描标记并移除；保持提交即可。

---

## 四、别人怎么装

三条命令，任选一条（`desktop` 换成对方的 profile 名）：

```sh
# A. 预构建包（最快，不需要 git、不需要跑构建脚本）
dsh plugin --profile desktop add https://github.com/lrhero/dsh-quick-chat/releases/latest/download/dsh-quick-chat.tgz

# B. 直接从仓库装
dsh plugin --profile desktop add github:lrhero/dsh-quick-chat

# C. 市场里点卡片装（上架成功之后）
```

装完重启 Harness，插件出现在 **设置 → 插件**，可随时启停。

---

## 五、npm（可选）

### 为什么默认不发

`dsh-quick-chat` 这个名字在 npm 上**已经被另一个作者占用**（`youxia2026/dsh-quick-chat@0.1.4`，功能还很像：也是把 DeepSeek 网页塞进面板）。即使抢注也拿不到这个名字，而且两个同名插件会让人装错。

所以默认不发布 npm。市场的收录与安装都不依赖 npm：**发不发 npm，条目都在，安装都能用**，区别只是市场里没有下载量数字、npm 搜索搜不到。

### 如果决定要发

先确认自己的 npm 账号叫什么：

```powershell
npm login          # 浏览器里登录
npm whoami         # 打印用户名
```

也可以打开 <https://www.npmjs.com/settings/~> 看个人主页地址。拿到用户名后有两种选择：

**A. 带作用域的包名（推荐，只要账号是你的就一定能发）**

```powershell
npm publish --access public
```

前提是把 `package.json` 的 `name` 改成 `@<你的用户名>/dsh-quick-chat`。

**B. 换一个非作用域名（任何账号都能发）**

`dsh-quick-chat-panel`、`dsh-quickchat`、`dsh-vendor-chat` 在 npm 上都还空着，发之前再确认一次：

```powershell
npm view dsh-quick-chat-panel version   # 返回 404 才是没被占
```

### 改名要一起动的地方（少一处装完就没反应）

| 位置 | 改成 |
|---|---|
| `package.json` → `name` | 新包名 |
| `cordis.patch.yml` → `insert[0].name` | **必须和新包名完全一致**，Loader 按这个名字解析模块 |
| `client.js` → `__ModuleLoader__.load({ id: ... })` | 新包名 |
| `test/package.mjs` | 里面断言了三者一致，改完自然通过 |
| 你本机 `~/.dsh/profiles/desktop/package.json` | 依赖键改成新包名 + `link:` 路径不变，`dsh.profile.bundles` 同步改名，然后 `pnpm install` |
| 你本机 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `- id: quick-chat` 覆盖段 | `name:` 改成新包名 |

发完之后，市场上那张卡片的安装命令会自动切到 npm 包（前提是 npm 包的 `repository` 字段指回这个仓库，现在已经是了）。

---

## 六、发版前的自检清单

```powershell
npm test            # 25 项功能断言 + 11 项打包/元数据断言
npm run pack:check  # tarball 里到底有哪些文件
```

人工确认：

- [ ] `package.json` 的 `version`、`CHANGELOG.md` 顶部、README 徽章三处一致（测试会拦）
- [ ] 仓库 About 里有 `dsh-plugin` topic
- [ ] Release 里 `dsh-quick-chat.tgz` 能下载、大小正常
- [ ] 在一台干净的机器（或新的 profile）上真装一次，确认头部出现头像
- [ ] 市场条目里的描述与代码一致，没有写没做的功能

---

## 七、常见被拒/搜不到的原因

| 现象 | 原因 |
|---|---|
| 话题页搜不到 | 仓库没有 `dsh-plugin` topic，或仓库不是公开的 |
| 市场 PR 被 CI 拒 | `package.json` 只声明了 `dsh.client` 没有 `dsh.bundle`；仓库创建不到 1 天；一个 PR 改了超过 3 条;YAML 里手写了 `npm:` 字段 |
| PR 被打回重写描述 | 描述里的功能、数字、API 名与代码对不上 |
| 装完设置里没有这个插件 | 装错了 profile（桌面端的 profile 由应用托管，别用 `--profile` 猜） |
| 装完界面没反应 | `cordis.patch.yml` 的 `name` 和实际包名不一致，Loader 解析不到模块 |
| 详情页报错而不是显示图 | `locale/*.json` 里的 `meta.detail` 指向的文件不在包里（`files` 漏了 `docs`） |
| 图标显示成默认图 | `icon.png` 超过 256 KiB、不是有效 PNG，或 `icon` 字段路径不在包内 |
