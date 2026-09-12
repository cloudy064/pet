# 皮皮动画引擎与透明 PNG 调试台

## 学习宠物扩展（开发中）

新增可选的 `PetCompanion`：学习成长与存档、首页/做题/照料/休息模式、喂食与幂等钱包接口、香皂涂抹、连续抚摸、主动请求及中英台词。运行后打开 [皮皮的小院](examples/companion/index.html)，接口见 [宠物接入文档](docs/PET_COMPANION_API.md)，当前验证与待完成内容见 [扩展验收记录](docs/PET_COMPANION_VALIDATION.md)。

16 个新动作已交付透明运行图集（538 帧），包含自然收尾的分段循环、独立葵花籽/木桩道具，以及中英文原创数数歌的合成歌声示例。打开 [宠物体验](examples/companion/index.html) 或 [动作逐帧预览](examples/companion/animations.html)；详见 [素材说明](assets/companion/README.md)。

## 全局素材优化

当前完整动作预览页仅运行 WebP，保留动作选择、循环播放、暂停、速度和时间轴；不会下载 PNG 或等待原图同步。

Web 演示已默认采用 WebP 小图集：图片总量 **15.63 MiB**，相比原始 PNG 的 64.49 MiB 减少 **75.8%**。保留全部 1,849 个逻辑帧、计时、透明度和位置偏移，原始素材与 PNG 优化版本仍保留。

安装 `requirements-optimization.txt` 并准备本机 tinyimg 后，运行 `npm run build`、`npm run compress:webp`。把 `dist/optimized-webp-frames/` 托管到 `/pet-assets/`，Web 接入方式为：

```js
const pet = Pipi.createWebPet(canvas, { assetPack: '/pet-assets' });
await pet.ready;
await pet.play('wave');
```

首屏只下载站姿与嘴部所需图片（约 20 KiB），其他动作按需加载。SDK 自动读取清单、注册动作并处理共享帧与偏移。页面卸载时调用 `pet.destroy()`。WebP 目前用于 Web；微信接入继续使用 PNG 资源包。

运行 `npm run demo` 后，默认入口为 WebP 演示。`examples/sdk-demo/?assets=png` 可查看原 PNG 单图包；`?assets=tinyimg` 保留受保护 PNG 压缩版本。完整动作预览在 [WebP 动作预览](examples/optimization/index.html?profile=webp)。`npm run build:assets` 仍用于生成 PNG 单图，命令与历史方案详见 [全局优化文档](docs/GLOBAL_ASSET_OPTIMIZATION.md)。

## 当前代码导航

最小 SDK 示例在 [examples/sdk-demo](examples/sdk-demo/index.html)，仅加载引擎脚本并通过 `assetPack` 接入优化资源。已有构建产物时运行 `npm run demo`，访问 `http://localhost:8765/`；该命令默认绑定 `0.0.0.0`，局域网可用本机 IP 访问。可用 `PORT=9000 npm run demo` 改端口。首次使用先按优化文档安装依赖并执行 `npm run build` 和 `npm run compress:webp`。示例提供六种动作、暂停、调速和恢复站姿。

新接入使用 `engine/`：`core/` 管播放与渲染，`adapters/` 管 Web/微信平台，`companion/` 管学习宠物；照料控制器在 `companion/care.js`，存档原子写入在 `companion/storage.js`。`examples/companion/ledger.js` 是示例专用的本地钱包和事件队列。

根目录的 `pipi-*.js` 与中文调试页面属于保留的旧版播放器，供素材验证和历史体验使用。新增业务能力优先放入独立引擎，避免在两套播放器重复实现。下面的素材制作、外部项目集成记录包含历史信息，不是独立 SDK 的运行依赖。

学习事件现在必须传稳定递增的 `revision`；自定义存储必须支持原子 `save(state, {expectedRevision})`。Web 内置存档需要 HTTPS/localhost 的 Web Locks，迁移步骤和冲突恢复见 [宠物接入文档](docs/PET_COMPANION_API.md#从旧调用迁移)。

## 获取与运行

仓库：<https://github.com/cloudy064/pet>。代码、动作配置、原始素材、运行图集、制作记录和构建检查脚本均纳入版本管理；图片与姿态数组（NPZ/NPY）使用 Git LFS 保存完整内容。

安装 Git 和 Git LFS 后运行：

```sh
git lfs install
git clone https://github.com/cloudy064/pet.git
cd pet
git lfs pull
python -m http.server 8765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8765/` 后打开需要的页面。已有素材可直接播放，无需安装图片制作依赖；也可以双击 HTML 使用内置素材注册表。

| 页面 | 用途 |
| --- | --- |
| [动画调试台](皮皮_动画调试台.html) | 表情动作、逐帧查看、导入导出 |
| [自由动作](皮皮_自由动作.html) | 随机动作与走路、飞行位移 |
| [走路调试台](皮皮_走路调试台.html) | 八方向走路 |
| [飞行调试台](皮皮_飞行调试台.html) | 起飞、八方向飞行与落地 |
| [指字调试台](皮皮_指字调试台.html) | 左右单翅指向和独立鸟喙张合 |
| [压缩前后对比](皮皮_压缩前后对比.html) | 原始素材与运行素材对照 |
| [最初设计面板](皮皮_纯角色设计与调试面板.html) | 原始设计参考 |

提交图片前检查 `git lfs status`，普通 `git add`、`git commit`、`git push` 会同时管理图片版本。获取仓库时请使用上述 Git LFS 流程，以免只拿到图片指针文件，详见 [GitHub LFS 说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)。

`.gitignore` 排除了 `edge-*` 浏览器调试用户数据、`.tools` 本机工具依赖、缓存及根目录自动生成的截图/检查报告。`assets/` 中的参考图、制作中间素材和验证记录保留。部分小程序导出脚本依赖原工作区中的识字项目路径，迁移工作区时需先检查这些脚本的输出路径；本仓库的 HTML 调试台可独立运行。

## 独立动画引擎

`engine/` 提供面向对象的 `PipiEngine`，支持 Web 和微信小程序。动作定义、时间轴、资源缓存、Canvas 渲染和平台适配各自独立；可以注册/修改/删除动作、编排组合、添加自定义类型或插件。

```sh
npm ci
npm run dev
```

打开 [皮皮引擎工作台](皮皮_引擎工作台.html)：管理动作、调整速度和停留、逐帧预览、八方向移动、自由活动、语音组合及项目导入导出。原有页面继续保留。

```js
const pet = Pipi.createWebPet(canvas, { size: 112 });
await pet.ready;
await pet.play('wave');
await pet.moveTo({ x: 300, y: 320 }, { mode: 'flight' });
```

- [API 文档](docs/ENGINE_API.md)：播放、动作库、扩展、缓存和生命周期。
- [接入与迁移](docs/ENGINE_INTEGRATION.md)：Web / 微信组件、独立包、素材托管和验证命令。
- [Web 示例](examples/web/index.html)；微信示例执行 `npm run example:wechat` 后导入 `examples/wechat/`。
- `npm run pack:engine` 生成可供其他项目安装的 `.tgz`，无需引用识字或数学项目的源码；尚未发布到 npm 注册表。

启动所需的默认图、招手、右翅和鸟喙随代码包内置，其他动作可使用现有公共地址或自行托管 `assets/engine/`。微信按 MD5 持久缓存，清单支持 ETag 更新。

## 单翅指字

打开 `皮皮_指字调试台.html`，可切换画面左、右两侧翅膀，检查“完整播放”“展开并保持”和“收回”，调整停留时间或逐帧查看。“同时说话”让鸟喙独立张合，停留时翅膀保持稳定。

`assets/pipi-point-left.png` 是 17760×512 的透明横向长图，每帧 480×512，共 37 帧、19 种独立姿态。它复用已确认的打招呼 v8 完整画面 0–18，然后反向返回，停止在单翅横展、双眼睁开的姿态，不进入招手的眨眼与挥动阶段。没有重新绘制、插值或修改角色像素；首尾与原站姿一致。展开 740 ms、默认保持 1800 ms、收回 760 ms，总时长 3.3 秒；延长第 19 帧即可保持指向。`pipi-point-left.json` 记录原始帧坐标、脚底锚点、阶段及来源索引，压缩运行配置在 `assets/runtime/pipi-point-left.json`。

`assets/pipi-point-right.png` 同样为 37 帧、每帧 480×512。右翅来自内置 image_gen 生成的关键姿态，身体和头部固定，再补齐局部过渡；没有整只镜像。详细提示词、生成原件与采用方式见 [制作记录](assets/pipi-point-right-generation.md)。原来 31 组动作的注册表、素材和压缩统计保留。

**历史外部小程序集成记录**（以下业务策略不由当前 SDK 自动启用）：识字小程序曾接入两侧指字，按实际汉字边界停靠，右边界空间不足时站到字的左侧、用画面右侧翅膀指字，讲解中独立张合鸟喙。距离超过 `max(160px, 2×皮皮尺寸)` 时飞过去，并约有 25% 的选字机会优先选择远处目标；飞行按实际位移选择八方向，近处走路。拖动保持静态，单击延迟 350ms 触发抚摸，双击不播放动作。

小程序包内提供默认图、完整招手、右翅和鸟喙的区域 PNG，首屏招手不等待网络。欢迎过程循环一次完整挥翅、一次较小挥翅和停顿，讲话结束后自然收翅。首页、详情页和游戏页共用 58px 起始尺寸及星星成长曲线；获星先开心跳跃，落地后用 1.2 秒动画长大，结束保留增大的尺寸。当前本地 PNG 使用 256 色量化衍生图；完整原图保留。

远程图集首次使用后保存到小程序本地，页面释放只清理解码内存。清单按 10 分钟间隔检查 ETag/Last-Modified，PNG 按 MD5 或现有带哈希的文件名复用；断网可使用已缓存的动作。当前 SDK 的缓存、发布和验证说明见 [接入与迁移](docs/ENGINE_INTEGRATION.md)。

复现顺序：`python build_point_action.py` → `python prepare_point_right.py` → `python build_point_bundle.py` → `python build_miniprogram_welcome.py`。本仓库指字素材验证：`python check_point_preview.py`，结果为 `point-browser-check.json`。外部小程序的测试和截图不属于本仓库交付；独立引擎使用本文及接入文档中的 `npm` 检查命令。

## 无损压缩运行素材

打开 `皮皮_压缩前后对比.html`，可同步播放或逐帧对照全部 31 组动作，切换深色、薄荷、透明棋盘格背景。表情、走路、飞行和自由动作页面默认使用压缩运行素材；页面地址加 `?assets=original` 可以使用原始长 PNG。

| 项目 | 原始素材 | 运行素材 | 减少 |
| --- | ---: | ---: | ---: |
| 31 张 PNG 文件 | 85.00 MiB | 65.81 MiB | 22.6% |
| 全套 RGBA 像素存储量 | 1415.45 MiB | 649.50 MiB | 54.1% |
| 实际存储图片数 | 1162 | 900 | 播放仍为 1162 帧 |

运行图仍是透明背景横向 PNG。同一动作统一裁掉共同的透明留白，保留至少 8 像素滤波余量；逐像素相同的完整帧只存一次，以 `frameMap` 还原原来的播放顺序。PNG 再经 Oxipng 无损压缩，未缩小素材分辨率，也未使用有损编码。打包时重新还原全部 1162 个逻辑帧，验证 RGBA 每个字节一致，并核对原文件哈希未改变。

`assets/runtime/` 包含带内容哈希的运行 PNG、各动作配置和 `manifest.json` 统计；`assets/pipi-runtime-assets.js` 供双击本地 HTML 时直接读取。`pipi-sprites.js` 把裁边后的图片映射到原始虚拟画布与锚点。长图先解码一次再切帧，完成后释放整图；播放器只缓存独立姿态，重复播放帧引用同一个 ImageBitmap。少量首尾静态姿态另保留共同取样矩形，确保跨动作缩放衔接一致。不支持 ImageBitmap 时使用 Canvas。

表中像素存储量按原尺寸宽 × 高 × 4 计算，并非浏览器进程实测内存；解码暂存、取样辅助画布、浏览器纹理等还有额外开销。自由模式继续使用原有 75% 解码预览尺寸，运行版缓存目标上限降到 96 MiB（原图对照模式为 192 MiB），完整路线与待机素材受保护。表情、走路和飞行调试台保留原尺寸解码。逐帧时长、位移、循环区间、导出完整原尺寸 PNG 与 JSON 的行为不变。

所有原始 PNG、配置与中间素材均保留，因此工作目录会增加一套运行素材；节省的是实际播放所需的文件和像素缓存。对比页下载的运行 PNG 必须与运行配置一起使用，不能套用原长图的切格坐标。

重新制作图片或调整节奏后，先同步原配置，再重新打包运行素材：

```text
python optimize_motion_timing.py
python -m pip install --target .tools/pyoxipng pyoxipng==9.1.1
python build_runtime_assets.py
node run_compression_check.cjs
```

打包脚本还依赖 Pillow、numpy，已有运行文件可直接使用，无需安装 Python 工具。`compression-browser-check.json` 记录浏览器原尺寸像素对照、位图复用、Canvas 兼容路径、对比页操作及四个播放器的运行 PNG 请求。缩放后的浏览器滤波可能有细微像素差异，对比页可放大查看；原尺寸还原单独做严格相等检查。原有四套播放器检查继续覆盖节奏、首尾姿态、透明导出、各方向位移和实播。

飞行片段检查在首次生成缩略图后，先留出两个刷新回调显示首帧，再启动播放时钟，避免首次布局耗时使 40 fps 片段跳过开头画面；重复的异步检查请求只由最新请求更新预览。动作配置的逐帧时长和自由飞行的位移时钟不变。本轮 15 个飞行片段的 396 帧实播完整，八方向走路及自由模式连续混合动作也未记录到跳帧，详见对应播放检查 JSON。

## 自由动作模式与全局节奏优化

打开 `皮皮_自由动作.html`，点击“开始自由活动”。表情调试台顶部也有入口。默认每次完整动作结束后休息 3–6 秒，再随机选择一个动作；可以改为 1–3 秒或 6–10 秒，勾选动作范围，调整整体节奏，或指定下一次动作和移动方向。

- 表情动作保持当前地面位置。跳跃的局部腾空已在 PNG 内。
- 走路支持八方向，以一轮完整步态对应一个 `stride`，起步和停步原地完成。
- 飞行支持八方向：蓄力起飞 → 必要的转向 → 连续扑翼并移动 → 回正 → 在新位置落地。上下方向沿舞台纵轴移动，飞行高度独立计算。
- “暂停”冻结动作、位移和休息倒计时；“结束本轮”做完当前整段动作再停；“回到中央”立即取消计划并复位。指定动作会排在当前动作之后。
- 根据全部素材的透明边界和完整翼展预留空间，选择可达路线。指定方向空间不足时自动选取可达方向。多个候选时避免紧接着重复同一个动作。

`pipi-free-engine.js` 负责路线与逐帧时钟，所有动作共用 `(x, y)` 地面锚点、独立的 `alt` 高度和统一身体尺寸。整个移动序列预解码后才开始。`pipi-free.js` 管理随机间隔、异步请求取消、UI 和缓存。解码预览按 75% 尺寸缓存，运行版目标上限 96 MiB，当前完整路线与待机素材受保护；原始 PNG 文件不变。隐藏页面时冻结，返回时从原处继续。

本轮保留全部已确认的 PNG 和帧数，修改逐帧时长：眨眼闭合快、睁开慢；挥翅抬起与收回更利落；单眼眨眼和歪头缩短中间停留；说话增加一句之间的闭嘴停顿；抚摸保留舒适停留；跳跃缩短腾空，保留落地缓冲。走路循环由约 1.07 秒改为 0.96 秒，背向转身适当放慢；起飞和收翅落地减少拖延。

三个动作调试台、自由模式和直接下载 JSON 使用相同的 `frameDurationsMs`。打招呼历史对比页保留统一的 30 fps，方便比较两版绘图。`frameRate` 仅是原素材采样信息，变速时间轴以每帧时长为准。`originalTiming` 保留调整前节奏。重新生成任何素材后执行 `python optimize_motion_timing.py`，它会同步各 JSON 与三份浏览器注册表；`build_asset_registry.py` 现在只同步已有配置，不再覆盖眨眼时长或改写默认 PNG。

检查：`node check_free_engine.cjs`（400 次随机动作与四角边界）、`node run_free_check.cjs`（浏览器动作衔接、八向位移、暂停/停止、随机调度、缓存、真实刷新播放及手机布局）。`node run_free_check.cjs --resilience-only` 另测加载失败重试、关闭待机眨眼、切后台恢复和取消待执行飞行。结果见 `free-engine-check.json`、`free-browser-check.json`、`free-playback-performance.json` 和 `free-resilience-check.json`。`rhythm-review.jpg` 是优化时查看的全动作抽帧图。

## 八方向走路

打开 `皮皮_走路调试台.html`。选择方向后点击“开始走路”，或按住八方向按钮、方向键 / WASD；两个方向键同时按下可斜走。松开后走完当前步态再停下。“走一轮”播放完整起步、一次循环和停步；“原地检查脚步”可固定舞台位置。方向切换会先完成停步，再转向新的朝向。

| 朝向 | 角色视角 | PNG |
| --- | --- | --- |
| 向下 | 正面 | assets/pipi-walk-s.png |
| 左下 / 右下 | 侧前 | assets/pipi-walk-sw.png / pipi-walk-se.png |
| 向左 / 向右 | 侧面 | assets/pipi-walk-w.png / pipi-walk-e.png |
| 左上 / 右上 | 侧后 | assets/pipi-walk-nw.png / pipi-walk-ne.png |
| 向上 | 背面 | assets/pipi-walk-n.png |

八张长图均为 **29280×576**，单格 **480×576**，每方向 **61 帧，逐帧计时，步态循环 0.96 秒**。从 0 开始计数：0–13 起步，14–45 为 32 帧连续步态，46–60 停步。首次播放起步，持续走路只循环 `loopRange`，停止时在循环相位 0 接入 `outroRange`。帧 0、60 是原始默认图的相同拷贝；帧 14 与 46 逐像素相同。最小透明边距 25px。

`assets/pipi-walk.json`、`assets/pipi-walk-assets.js` 和各方向同名 JSON 包含帧矩形、时长、锚点、循环区间与 `stride`。`stride` 是原生坐标中每轮的移动距离，舞台位移为 `stride × 显示比例 × 已经过的循环比例`；步速同时改变动作和位移。正面/背面的透视步幅比侧面小。`contacts` 使用最终单格坐标，描述两只脚的支撑阶段和地面投影，不是独立的角色碰撞轮廓。

素材来自内置 image_gen 生成的五个基础视角，右侧三个视角逐帧镜像。完整脚掌保持生成的形状，头部和躯干保留统一绘图，仅有小幅周期起伏及踝部连接调整。原始关键姿态仍有少量脚掌纹理差异，可通过逐帧模式检查。提示词与采用方式见 `assets/pipi-walk-generation.md`。

复现：`python prepare_walk.py` → `python pack_walk.py`。检查：`python check_directional_assets.py`、`node run_walk_check.cjs`。文件检查结果在 `assets/pipi-directional-artifact-check.json`；浏览器结果在 `walk-check-result.json`、`walk-playback-performance.json`、`walk-pointer-check.json`。走路按需加载并最多缓存三个方向，避免一次解码所有长图。

## 飞行调试

打开 `皮皮_飞行调试台.html`（原调试台顶部也有入口）。点击“起飞”，按住方向按钮、方向键或 WASD 控制八方向飞行，组合按键可以斜飞。松开后减速悬停，点击“落地”或按空格返回地面。也可运行完整八向演示。页面支持暂停、慢放、移动速度调整、深色/透明背景、逐帧查看和单独下载各片段。

左右使用侧身飞行姿态，上下使用正面扑翼，四个斜向使用独立的倾身扑翼 PNG。侧身与正面通过转向片段衔接，斜向与侧身通过倾身片段衔接；反方向转弯先经过正面，落地前也会回到正面。切换在扑翼的共同姿态处进行，因此转向可能等待当前翼拍结束。按需解码，最多缓存四个片段；首次切换未加载的片段时短暂停留在当前画面，准备完后继续计时。

| 飞行片段 | PNG | 帧数 | 时长 |
| --- | --- | --- | --- |
| 起飞蓄力 | assets/pipi-flight-takeoff.png | 29 | 0.805 秒 |
| 正面扑翼 / 上下 / 悬停 | assets/pipi-flight-hover.png | 32 | 0.80 秒循环 |
| 向右飞行 | assets/pipi-flight-right.png | 32 | 0.80 秒循环 |
| 向左飞行 | assets/pipi-flight-left.png | 32 | 0.80 秒循环 |
| 正面转右 | assets/pipi-flight-turn-right.png | 17 | 0.425 秒，可倒放 |
| 正面转左 | assets/pipi-flight-turn-left.png | 17 | 0.425 秒，可倒放 |
| 落地回稳 | assets/pipi-flight-land.png | 41 | 1.115 秒 |
| 右上 / 左上 | assets/pipi-flight-up-right.png / pipi-flight-up-left.png | 各 32 | 0.80 秒循环 |
| 右下 / 左下 | assets/pipi-flight-down-right.png / pipi-flight-down-left.png | 各 32 | 0.80 秒循环 |
| 侧身转向四个斜向 | assets/pipi-flight-bank-{up/down}-{left/right}.png | 各 17 | 0.425 秒，可倒放 |

原七个片段每格 **704×576**，定位点 `(352, 486.453…)`。新增斜向及倾身片段每格 **704×640**，上下各扩展 32px，定位点相应为 `(352, 518.453…)`；所有帧在各自片段内尺寸相同。PNG 与同名 JSON 成对使用。长图最长 28864 像素，保留真实 Alpha。`assets/pipi-flight.json` 包含全部片段、方向映射、`turnGraph` 和移动参数，`assets/pipi-flight-assets.js` 让页面双击即可加载。起飞第一帧、落地最后一帧是默认原图缩成 256×512 后放在 `(224,48)` 的精确拷贝；起飞末帧、正面扑翼首帧、落地首帧及转向端点均共享对应像素。

十五组共 396 帧。`python check_flight_assets.py` 检查实际 PNG 的透明通道、边距、首尾衔接与原扑翼的面部稳定性，`python check_directional_assets.py` 另检验斜向/侧向过渡端点；`node run_flight_check.cjs` 检查浏览器中的八向控制、转向、暂停、落地、逐帧播放和真实鼠标按住/移出释放。结果分别写入 `assets/pipi-flight-artifact-check.json`、`flight-check-result.json`、`flight-playback-performance.json` 和 `flight-pointer-check.json`。生成关键姿态之间仍有少量羽毛纹理形变，可用深色背景和慢放检查。

**飞行位移与局部姿态分开**：PNG 只包含蓄力、收脚、扑翼、转身和收翅，控制器在舞台坐标中移动定位点；不要像跳跃素材一样假设位移已全部烘焙进 PNG。起飞第 17 帧开始抬升，落地第 11 帧接触地面。画面按完整翼展预留边界。上限和左右边界会减速/限制角色的位置，向下到低空后仍悬停，需要明确点击落地。

姿态由内置 image_gen 结合三张用户参考卡生成；正面扑翼和转向各补充生成了一组更密的姿态。`assets/pipi-flight-generation.md` 保留完整提示词与来源。新增斜向候选生成图的身体/翅膀比例不够稳定，最终沿用已稳定的 32 帧扑翼绘图，将 ±22° 倾身及过渡烘焙进 PNG；记录见 `assets/pipi-flight-diagonal-generation.md`。复现命令：`python prepare_flight.py` → `python pack_flight.py` → `python pack_flight_diagonals.py`。单独扩展斜向时只运行最后一步，不会改写原七张 PNG。飞行使用独立控制器 `pipi-flight.js`，现有八个动作继续由原播放器处理。

打开 `皮皮_动画调试台.html`，可直接双击本地文件，不需要构建；请保留 assets、CSS、JS 的相对路径。

`皮皮_打招呼对比.html` 同步播放上一版 v7 和当前 v8，支持正常速度、半速和逐帧检查。

## 当前动作

| 动作 | PNG | 每格宽高 | 图片帧数 | 默认时长 |
| --- | --- | --- | --- | --- |
| 默认姿态 | assets/pipi-idle.png | 362×724 | 1 | 静止，可定时眨眼 |
| 眨眼 | assets/pipi-blink-clean.png | 362×724 | 24 | 0.46 秒 |
| 自然打招呼 v8 | assets/pipi-wave-smooth.png | 480×512 | 61 | 1.83 秒，逐帧计时 |
| 俏皮单眼眨眼 | assets/pipi-wink.png | 384×512 | 33 | 1.34 秒，含微笑停留 |
| 说话 | assets/pipi-talk.png | 384×512 | 32 | 1.82 秒，含音节间停顿 |
| 抚摸反馈 | assets/pipi-pet.png | 384×512 | 37 | 约 1.75 秒，含开心停留 |
| 开心跳跃 | assets/pipi-jump.png | 544×640 | 49 | 约 1.44 秒，含起跳和落地缓冲 |
| 好奇歪头 | assets/pipi-curious.png | 384×512 | 41 | 1.76 秒，含观察停留 |

新增动作从下拉框选择“俏皮单眼眨眼 · 歪头微笑”，或点击“单眼眨眼一次”。画面右侧闭眼，左侧保持睁开，头部轻转 5 度后回正，身体和双脚固定。第 17 帧停留240ms，使用单帧延时代替重复图片；首尾对应实际静态原图。该动作与双眼眨眼、打招呼分别导出。

说话动作选择“说话 · 嘴型开合”，或点击“说话一次”。7 种完整嘴型组成 32 帧，只表现鸟喙自然张开、合拢，以开口幅度和短暂停顿变化说话节奏；已去掉圆口嘴型。双眼持续睁开，头部轮廓和身体完全静止。首尾回到默认闭嘴姿态，可勾选循环连续播放，PNG 与 JSON 单独导出。

抚摸反馈选择“抚摸反馈 · 眯眼微笑”，或点击“抚摸一次”。双眼慢慢闭成开心的弧线，鸟喙自然张开微笑，头部轻轻下移并侧倾，再沿同一路径返回。身体和双脚固定，第 19 帧停留 420ms；首尾与默认姿态一致。当前提供角色自身的反馈动作，手和爱心不包含在 PNG 中。

开心跳跃选择“开心跳跃 · 展翅腾空”，或点击“跳跃一次”。先压低蓄力，再展开双翅跳起、收脚微笑，落地缓冲后收翅回正。49 帧统一使用 544×640 画布，给双翅和腾空高度留出空间；首尾与现有默认姿态一致。跳跃位移已包含在 PNG 中，播放时保持 JSON 中的地面锚点固定，无需再叠加角色位移。

好奇歪头选择“好奇歪头 · 睁眼观察”，或点击“歪头一次”。双眼始终睁开，轻微挑眉、小幅张嘴，头部向画面右侧倾斜 16 度，观察停留 420ms 后回正。41 帧包含 21 种往返姿态，身体和双脚固定，首尾对应默认姿态；不包含参考卡片中的问号。

打招呼以 `assets/pipi-wave-user-midpose.png` 为中段参考：翅膀展开成宽扇形，配合笑脸、眨眼和轻挥，再收翅回到静态。姿态来自此前内置 image_gen 生成的四张图集。v8 筛选其中连续的姿态，重新制作过渡，并让收翅沿同一组姿态反向返回。

上一版固定了身体，但翅膀高度、面积仍在相邻生成帧之间反复跳变。v8 对独立翅膀图层进行双向光流配准，补出中间姿态；合成前对齐两端图像，并用距离场重建单一轮廓，避免未对齐的双翅透明叠影。头部轮廓、身体、右翅和双脚保持固定。眼睛和嘴部使用完整表情画面，不参与通用光流变形。此次没有重新生成角色图片，也没有旋转一张翅膀贴片来代替整套动作。少数羽毛纹理仍可能存在形变，视觉效果可在对比页查看。

长图为 29280×512、RGBA 透明 PNG。首尾两帧将实际静态 PNG 等比缩为 256×512，放在单格 x=160、y=0，与该静态姿势逐像素一致。`restPose` 记录来源及位置，`phases` 记录三段动作，`motionReconstruction` 与 `provenance` 记录所用旧帧及过渡比例。每帧统一画布与脚底锚点，透明边距最小为左 52、上 48、右 65、下 71 像素。

## 播放框架

`assets/pipi-assets.js` 是内置动作注册表。每个动作独立声明 `frameWidth`、`frameHeight`、`frames`、`anchor`、`bounds`、`frameDurationsMs`。JSON 与 PNG 同名、成对使用。`subjectHeight` 用于不同分辨率的动作保持相近显示大小，缺省为 548。

加载时将运行 PNG 预先拆成裁边后的原生尺寸 ImageBitmap 缓存，重复姿态共用位图；不支持时使用等尺寸 Canvas。内置动作使用共同的角色显示比例与脚底位置，并按所有动作的范围限制缩放。同一动作每帧尺寸相同，不同动作可不同。

首尾静态帧按 `restPose` 中的角色矩形取样绘制，使加入额外透明边距的动作也能与其他动作显示完全一致。整帧尺寸、时间轴、辅助线和 PNG 导出仍使用该动作的完整画布。

“静态原图对照”直接显示 `pipi-idle.png`；导入序列时对照其首帧。首尾画面与原尺寸静态 PNG 直接显示相比存在少量缩放滤波差异，姿势和位置相同。

时间轴和缩略图显示实际图片帧。“按动作设计的节奏”使用逐帧时长；固定 fps 只改变停留时间。启动时先给首帧一次绘制机会，再开始计时；播放时容许 0.25ms 的帧边界误差，避免刷新时间取整造成重复和跳帧。上一帧参考只在暂停时叠加。

默认姿态只存一帧。自动眨眼队列为静态停留 2600ms、24 帧眨眼、静态停留 900ms，时间轴共 26 项。导出的默认配置包含眨眼动作引用和等待时间。

## 导入与导出

导入最多 96 张 PNG，按文件名自然排序。同一动作须同尺寸，保留原尺寸；脚底默认位于单格宽度 50%、高度 90%。拼接宽度超过 30000 或总像素超过 4000 万时，拒绝导入并保留当前动作。

PNG 导出保留原图尺寸与 Alpha。JSON 导出与当前计时方式一致，包含逐帧时长、矩形与锚点；预览速度和舞台背景不写入。直接下载链接提供当前长图与默认配置。

## 素材制作与检查

完整打招呼制作流程：

```text
python prepare_wave_generated.py
python stabilize_wave_generated.py
python prepare_wave_smooth.py
python check_wave_motion.py
python optimize_motion_timing.py
```

依赖 Pillow、numpy、opencv-python-headless。第一步从 `assets/pipi-wave-natural-A.png` 至 `D.png` 与静态图提取姿态并清除实色棋盘格背景，结果保留为 `pipi-wave-generated`。第二步使用已有的 `pipi-wave-idle-body.png`，生成 v7 及独立的 `pipi-wave-wing-layers.png`、`pipi-wave-fixed-base.png`。第三步制作当前 `pipi-wave-smooth` PNG 与 JSON。若这些中间素材已经存在，可直接从第三步开始。

原始生成记录与提示词见 `assets/pipi-wave-natural-generation.md`，当前抽帧预览为 `assets/pipi-wave-smooth-check.jpg`。眨眼制作入口为 `repair_animation_assets.py`，使用 12 个独立眼部姿态组成 24 帧；它会重建旧版打招呼素材，运行后须重新执行上述流程。

运行 `node run_browser_check.cjs`，通过本机无界面 Edge 检查首尾静态对应、三档缩放、原生计时、全部帧范围、PNG 导出、导入、固定区域及当前素材版本。结果为 `player-check-result.txt`，截图为 `wave-v2-preview.png`。它还检查对比页的两套素材加载与同步定位，截图为 `wave-comparison-preview.png`。实际刷新下的播放测量见 `playback-performance.json`，仅反映本机该次测试，render 耗时不含显示器呈现延迟。

`check_wave_motion.py` 直接检查 PNG 的首尾一致、固定身体区域、透明边距，并追踪蓝色翅膀的重心和顶部边缘。v7 到 v8 的最大重心单帧位移从约 56.4 降至 13.8 像素，相邻位移的最大变化从约 90.6 降至 8.8 像素。结果和测量定义见 `assets/pipi-wave-smooth-validation.json`。这些指标用于发现突跳，不能代替对羽毛细节与动作自然度的视觉判断。

单眼眨眼的制作与检查：

```text
python prepare_wink.py
python optimize_motion_timing.py
node run_browser_check.cjs
```

输入为本次内置 image_gen 生成的 `assets/pipi-wink-generated-poses.png` 和当前静态原图。来源与完整提示词见 `assets/pipi-wink-generation.md`，抽帧预览为 `assets/pipi-wink-check.jpg`，检查记录为 `assets/pipi-wink-validation.json`。实际浏览器截图为 `wink-preview.png`，实播记录为 `wink-playback-performance.json`。本次采到全部 33 帧，无跳帧；身体从单格 y=304 开始的所有像素保持一致，头部最大相邻角度变化约 0.47 度。

说话动作的制作与检查：

```text
python prepare_talk.py
python optimize_motion_timing.py
node run_browser_check.cjs
```

输入为 `assets/pipi-talk-generated-poses.png` 和当前静态原图。完整生成提示词、工具记录及处理说明见 `assets/pipi-talk-generation.md`。输出为 12288×512 的透明长图与逐帧计时 JSON；相邻帧不做嘴型叠化，Alpha 与嘴部之外的画面保持一致。素材检查见 `assets/pipi-talk-validation.json`，浏览器截图为 `talk-preview.png`，实播记录为 `talk-playback-performance.json`。

抚摸反馈的制作与检查：

```text
python prepare_pet.py
python optimize_motion_timing.py
node run_browser_check.cjs
```

输入为本次内置 image_gen 生成的 `assets/pipi-pet-generated-poses.png` 和当前静态原图。完整提示词与处理说明见 `assets/pipi-pet-generation.md`。图像生成负责双眼闭合与开心张嘴的表情；对齐后仅替换脸部对应区域，用一个原始头部图层做 7 度侧倾与 6 像素下移，身体从单格 y=308 开始逐像素固定。37 帧共有 19 种姿态，回程复用正向姿态，相邻帧没有重复图片。长图为 14208×512，最小透明边距为左 69、上 48、右 60、下 71 像素。

开心跳跃的制作与检查：

```text
python prepare_jump.py
python pack_jump.py
python optimize_motion_timing.py
node run_browser_check.cjs
```

输入为新生成的 `assets/pipi-jump-generated-poses.png`、原始默认姿态和已确认的抚摸表情素材。第一步提取和对齐 16 个姿态；第二步筛选连贯的展翅与收脚动作，分别估计翅膀和脚部的过渡，将起跳轨迹与落地缓冲烘焙进 26656×640 的透明长图。已有配准结果时可从第二步开始。完整提示词和处理说明见 `assets/pipi-jump-generation.md`，抽帧图为 `assets/pipi-jump-check.jpg`，检查记录为 `assets/pipi-jump-validation.json`。

好奇歪头的制作与检查：

```text
python prepare_curious.py
python optimize_motion_timing.py
node run_browser_check.cjs
```

输入为本次内置 image_gen 生成的 `assets/pipi-curious-generated-poses.png` 和原始默认姿态。仅使用生成图中的眉毛和轻微张开的鸟喙，保留原始双眼图像；以统一头部图层缓动歪头并回正，观察停留记录在逐帧时长中。长图为 15744×512，最小透明边距为左 69、上 48、右 55、下 71 像素。完整提示词和处理说明见 `assets/pipi-curious-generation.md`，抽帧图为 `assets/pipi-curious-check.jpg`，验证记录为 `assets/pipi-curious-validation.json`。

浏览器检查覆盖八个动作，包含好奇歪头的固定身体、观察停留、首尾衔接、三档缩放、透明 PNG 导出和独立计时，并保留已有动作的检查。最新结果见 `player-check-result.txt`；好奇歪头的实播记录为 `curious-playback-performance.json`，截图为 `curious-preview.png`。检查结果不代替对动作自然度的视觉判断。

原设计稿、旧素材和脚本保留供对照，当前播放器通过注册表使用上表中的八个 PNG。
