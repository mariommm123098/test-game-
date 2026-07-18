# 《我们都没有说谎》

> 序章《雨停之前》——一款双主角、双视角、情感悬疑互动叙事网页游戏。

**在线试玩：** `https://mariommm123098.github.io/test-game-/`

核心主题：

> 我们都没有说谎。  
> 我们只是把最重要的部分留在了心里。

## 当前完成内容

这是可以从头到尾试玩的序章原型，不是静态设计稿。当前版本包括：

- 电影化标题界面、继续游戏和设置；
- 临江市 23:47 的过场；
- 暴雨中的停业电影院场景；
- 周屿与林栀的完整序章争吵；
- 逐字对白、点击补全、再次点击继续；
- “选择你最先相信的人”双视角选择；
- 周屿、林栀两套不同的视觉、文字和合成声音演出；
- “二百一十六天前”和第一章预告；
- 返回标题、快速重选视角；
- 两个视角都看过后的额外文字；
- localStorage 自动保存；
- 对话历史、声音开关、文字速度和全屏；
- 电脑横屏、手机竖屏与矮屏横屏适配；
- CSS/Canvas 分层雨、地面涟漪、闪电、招牌与火车灯动态；
- 不依赖网络音频的 Web Audio 合成雨声和低频氛围。

## 最简单的本地运行方式

不要直接双击 `index.html`。部分浏览器会限制本地文件运行 JavaScript 或音频。

### 方法一：使用 VS Code

1. 下载并解压项目 ZIP；
2. 用 VS Code 打开整个项目文件夹；
3. 在 VS Code 扩展商店安装 **Live Server**；
4. 右键 `index.html`；
5. 选择 **Open with Live Server**；
6. 浏览器会自动打开游戏。

### 方法二：电脑有 Python 时

在项目文件夹中打开终端，输入：

```bash
python -m http.server 8000
```

然后打开：`http://localhost:8000`

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy-pages.yml`。每次更新 `main` 分支后，GitHub Actions 会自动部署。

第一次部署时如果链接暂时打不开：

1. 打开 GitHub 仓库；
2. 点击上方 **Settings**；
3. 左侧点击 **Pages**；
4. 在 **Build and deployment** 的 **Source** 中选择 **GitHub Actions**；
5. 再打开仓库顶部的 **Actions**；
6. 等待 `Deploy to GitHub Pages` 变成绿色对勾；
7. 打开 `https://mariommm123098.github.io/test-game-/`。

资源路径全部使用 `./` 相对路径，因此在 GitHub Pages 的子目录地址中也能正常加载。

## 文件结构

```text
test-game-/
├── index.html                         # 页面结构与全部界面容器
├── README.md                          # 当前说明
├── .nojekyll                          # 避免 Pages 使用 Jekyll 处理资源
├── .github/
│   └── workflows/
│       └── deploy-pages.yml           # GitHub Pages 自动部署
├── css/
│   └── style.css                      # 画面、动画、UI、手机适配
├── js/
│   ├── story.js                       # 剧情、对白、双视角文本数据
│   ├── audio.js                       # Web Audio 合成环境音系统
│   └── game.js                        # 游戏状态、交互、存档、演出逻辑
├── assets/
│   ├── images/
│   │   └── cinema-rain-PLACEHOLDER.webp
│   ├── audio/
│   │   └── README.md                  # 正式音频替换说明
│   └── icons/
│       └── README.md                  # 正式图标替换说明
└── tests/
    └── verify.mjs                     # 静态完整性和剧情数据检查
```

## 如何替换电影院背景图

当前背景图是为本原型生成的统一风格占位图：

`assets/images/cinema-rain-PLACEHOLDER.webp`

最省事的替换方法：

1. 准备一张横向图片，建议比例 16:9，分辨率至少 1920 × 1080；
2. 转换为 WebP，尽量控制在 2 MB 以内；
3. 新图片仍命名为 `cinema-rain-PLACEHOLDER.webp`；
4. 覆盖 `assets/images/` 中的旧文件；
5. 刷新网页。

如果你使用其他文件名，需要同时修改 `index.html` 中两处旧文件名：预加载 `<link>` 和场景 `<img>`。

## 如何替换人物素材

当前人物已包含在统一的电影院背景图中，CSS 使用局部光影让周屿或林栀在选择时更清晰，因此没有混用来源不明的动漫立绘。

以后制作正式人物素材时，建议：

1. 输出透明背景 WebP 或 PNG；
2. 周屿和林栀分别单独导出；
3. 放入 `assets/images/characters/`；
4. 在 `index.html` 的 `.scene` 内增加两张 `<img>`；
5. 在 `style.css` 中为两人分别设置位置、呼吸动画、模糊和高亮状态。

正式人物分层后，可以把选择视角时的“另一人变模糊”从光影模拟升级为真实图层模糊。

## 如何替换音频

当前没有任何联网音乐，也没有版权不明的音频文件。`js/audio.js` 会实时合成：

- 多层雨声；
- 雨棚水滴；
- 远雷；
- 火车低鸣；
- 视角选择低频；
- 纸张、行李箱提示；
- 结尾夏夜蝉鸣。

正式音频的建议文件名已经写在 `assets/audio/README.md`。

接入正式音频时，可以在 `js/audio.js` 中增加 `Audio` 或 Web Audio `AudioBufferSourceNode`，保留现有的 `start()`、`setMood()`、`playCue()` 接口。这样 `game.js` 不需要跟着重写。

注意：浏览器不允许网页未经用户操作自动播放声音。本项目会在玩家第一次点击“开始游戏”或“继续游戏”后才启动声音，这是正常行为。

## 如何继续增加第一章

剧情与界面逻辑已经分开。

1. 在 `js/story.js` 的 `future.chapters` 中添加第一章数据，或新建 `js/chapters/chapter-01.js`；
2. 每条剧情继续使用 `speaker`、`text`、`type`、`effect` 等字段；
3. 在 `game.js` 中新增 `beginChapter(1)`，让章节数据进入现有逐字系统；
4. 把结尾页锁定按钮改成可点击；
5. 扩充存档中的 `checkpoint`，例如 `chapter1.scene3`；
6. 分支选项建议使用唯一 ID，不要只用按钮显示文字作为判断条件；
7. “未发送消息”可以使用 `STORY.future.unsentMessages`，并单独制作手机界面；
8. 多结局可在 `STORY.future.endings` 保存条件、名称和入口场景。

建议第一章优先实现：大学初遇、第一段声音采集、修复室相遇，以及两位主角对同一件小事的第一次不同记忆。

## 存档说明

浏览器会使用 `localStorage` 保存：

- 是否已经开始；
- 序章是否完成；
- 周屿视角是否看过；
- 林栀视角是否看过；
- 最后选择的视角；
- 当前对白位置；
- 文字速度；
- 环境音和音乐开关；
- 最近 80 条对话历史。

浏览器隐私模式可能禁止永久保存，但不会影响本次打开时游玩。

如需清空测试进度，可打开浏览器开发者工具，在控制台运行：

```js
localStorage.removeItem("weNeverLied.save.v1");
location.reload();
```

## 当前占位素材

- `cinema-rain-PLACEHOLDER.webp`：AI 生成的序章概念背景，后续可替换为正式原画；
- 人物：当前作为背景图中的统一剪影处理；
- 雨、火车、雷、蝉鸣：当前由浏览器实时合成；
- 声波、未接来电、病历纸张、修复裂纹：当前为 CSS 图形；
- 图标：当前为项目内联 SVG。

项目没有从网络随意下载动漫人物或版权不明音乐。

## 已知限制

- 合成环境音用于原型验证，真实感仍不及专业录音与声音设计；
- 当前背景中的人物无法像独立立绘一样单独改变动作；
- Safari、iOS 和部分省电模式会主动暂停后台音频，回到页面后再次点击即可恢复；
- 全屏功能取决于浏览器支持，iPhone Safari 可能不显示标准全屏入口；
- 当前只有一个自动存档，没有多档位；
- 第一章正文、未发送消息系统、完整真相线和多结局尚未制作。

## 技术特点

- 原生 HTML / CSS / JavaScript；
- 无 React、Vue、后端和构建步骤；
- 无付费服务依赖；
- 核心体验可离线运行；
- 所有路径兼容 GitHub Pages 子目录；
- 遵守 `prefers-reduced-motion`，减少动画时仍可正常游玩。
