# 全局动作素材后处理

当前 Web Demo 与完整动作预览页仅选择 `dist/optimized-webp-frames/`：15.63 MiB，按动作加载。原始素材保留。PNG 文件暂时保留；当前 `/examples/optimization/` 不再创建原图实例，也不会下载 PNG。原对比实现移至 `comparison.html`，仅供回归验证。以下 PNG 构建命令仍保留原行为；生成 WebP 请执行 `npm run build` 和 `npm run compress:webp`。

工具：`scripts/optimize-animation-assets.py`。默认将基础引擎实际使用的素材（包括内置首屏 PNG、指字/嘴部补丁、上下飞行别名）与宠物扩展作为同一个资源库优化。也可重复传入 `--input`，处理多个含 `manifest.json` 的素材目录。

## PNG 单图构建方案：首次下载一张全动作图集

`npm run build:assets` 默认生成 `--layout single`：全部基础及扩展动作共用 **1 张 8448×7995 PNG**，54,296,234 字节（51.78 MiB），含 1,425 个去重姿态、1,849 个逻辑帧。相比原始 PNG 减少约 19.7%。`frameMap` 指向对应的 `tiles`，SDK 用矩形坐标及偏移还原动作，不再按动作下载图片。

`createWebPet(canvas, { assetPack: '/pet-assets' })` 的 `ready` 会等待整张图片加载完成。站姿始终引用这张图片，因此后续切换动作不会驱逐或重新下载它；销毁实例时才释放。单图 RGBA 像素约 **257.65 MiB**，超过默认 48 MiB 缓存软预算；被活动引用的图片不会被预算回收。首次下载需要等待整包完成。该尺寸已验证本机 Chromium，不能据此保证所有手机或微信真机都支持；需要较小图集时显式选择分页布局。

可选旧布局：`npm run build:assets -- --layout paged --output dist/optimized-paged`。它按动作分批加载图片，适合降低首屏传输与常驻内存。单图和分页保持相同姿态质量及播放时序。

真实 Demo：`npm run demo`，访问 `http://本机IP:8765/`。`scripts/check-sdk-demo-browser.py` 检查只有一次图片请求，并在断网后检查六个按钮动作的实际像素变化和完整播放。

## 之前分页布局的对比结果

本机这一版运行素材的结果如下，单位为 MiB（1,048,576 字节）。这里只比较 PNG，不含音频、清单、代码包、制作母版和 Git 历史。

| 档位 | PNG 总量 | 相比原始减少 | 实际存储姿态 | 唯一图集 RGBA 像素量 |
| --- | ---: | ---: | ---: | ---: |
| 原始实际运行库 | 64.50 | — | 1,523 | 351.19 |
| exact 无损 | 64.30 | 0.3% | 1,452 | 281.38 |
| balanced 平衡（默认） | 52.18 | 19.1% | 1,425 | 277.28 |
| compact 更紧凑 | 40.02 | 37.9% | 1,372 | 264.61 |

所有档位保留 1,849 个逻辑帧。物理姿态数按实际 PNG 区域统计，已排除原来就共用区域的飞行别名，不把它们重复算作优化收益。平衡档还有 37 组跨动作共享的姿态图片；17 次近似替换跨越不同动作及原物理区域。

**减少图片姿态的幅度比减色带来的体积收益小。** 这些素材已有不少动作内去重，进一步大幅抽帧会改变动作表现。因此工具同时提供跨动作姿态共享、透明裁剪和统一减色；不会将 PNG 节省比例宣称为删除的动画帧比例。

图集数量从 53 张增加到平衡档的 119 张。这是按使用者集合分组的选择：公共姿态共用一页，某个动作的私有姿态不塞进其他动作必须下载的页。最多 1024×1024，避免为了节约少量 PNG 字节而让一个小动作加载整套大图集。表中的 RGBA 是整套图集唯一像素量，**不是浏览器/微信进程内存**；渲染器另有最多约 8 MiB 的帧缓存，图集缓存默认约 48 MiB。

## 使用

首次准备依赖：

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements-optimization.txt
npm ci
```

Windows 使用 `.venv\Scripts\python.exe`。npm 命令优先选择仓库 `.venv`，也可设置 `PIPI_PYTHON` 指定 Python。普通播放不需要这些 Python 依赖。

```sh
npm run build:assets
npm run dev
```

- 平衡包：`dist/optimized-assets/`。
- 同步对比：`http://127.0.0.1:8765/examples/optimization/`，可选择动作、尺寸、速度、时间点和深色背景。
- 使用优化包的真实小院：`http://127.0.0.1:8765/examples/companion/?assets=optimized`。
- 逐项数值和替换来源：输出目录的 `optimization-report.json`。
- 误差最大的姿态对照：输出目录的 `pose-comparison.jpg`。

其他档位与自定义输入：

```sh
npm run build:assets -- --profile exact --output dist/optimized-exact
npm run build:assets -- --profile compact --output dist/optimized-compact
npm run build:assets -- --input assets/engine --input assets/companion --page-size 1024
```

对比页加 `?profile=exact` 或 `?profile=compact` 可查看对应输出。平衡档提高颜色精度，保留更多柔和渐变，适合默认体验；想保持每个像素时选 exact。更紧凑档增加姿态近似容忍度，节省幅度有限，应先看对比页。

可重复运行命令。工具在临时目录生成并逐帧验证，再替换它自己生成的目标目录；失败不会覆盖上一份有效产物。不会覆盖输入目录，也拒绝覆盖无法确认归属的非空目录。源 PNG、制作母版和旧版调试台保留，因此本工具减少的是**分发运行包**的体积，不会自动清理整个工作区或 Git 历史。发布时只复制优化后的运行包，不要把原始和优化素材一起带入引用项目。

`build:assets` 一次完成 SDK 构建、全局去重与减色、图集打包、偏移及动作清单生成、逐帧校验。默认输出可直接托管的 `dist/optimized-assets/`；可用 `--output` 指定独立目录。`npm run build` 仍只构建 SDK，`optimize:assets` 保留为 `build:assets` 的兼容别名，参数相同。

`assetPack` 接收目录地址（不含 `manifest.json` 文件名）。SDK 在 `pet.ready` 完成前读取清单、注册打包的基础及扩展动作、准备站姿；默认单图已包含其余所有动作，无需再请求图片；可选分页布局才在播放时按需加载其余图片。它与 `manifest`、`assets`、`assetBaseURL` 互斥，避免混用不同版本的图片。清单请求失败或内容不完整会使 `ready` 拒绝，不回退到旧素材。请捕获错误并在页面释放时调用 `pet.destroy()`。只包含自定义动作的包还需传 `preset: false`，且必须含 `base:idle`。

SDK 封装帧索引、共享缓存、裁剪偏移与原始栅格还原；业务不需要读取 `tiles` 等内部字段。音频播放与 `PetCompanion` 的钱包、存档配置仍由对应接口控制。

## 为什么是全局优化

1. **统一坐标进行搜索。** 按身体高度与锚点对齐全库姿态，而不是在每个动作中机械隔帧删除。候选可来自另一个动作。比较预乘 Alpha 的像素，分别约束轮廓、头部和较大变化像素比例；所有替换直接对照原帧，避免链式替换积累误差。
2. **跨动作内容去重。** 透明裁剪后按真实像素哈希建立共用姿态库；不同动作的放置位置独立保存。同样的图像在不同坐标出现，也能共用同一份像素。
3. **全库一致的颜色。** 平衡/紧凑档从全库采样构建一个 RGB 调色板（平衡档 1024 色、紧凑档 256 色），保留原 Alpha。超出组合误差预算的姿态自动使用原色。无损档不减色；所有档位仅将完全透明像素中不参与显示的 RGB 归零，不修改其 Alpha。可见像素与采样一致性另行验证。首尾、阶段边界、静止帧、嘴部/翅膀补丁及独立道具保留原像素，防止关键衔接和道具被简化。
4. **统一打包。** 默认将全库姿态放入一张图，所有动作共用。可选 `--layout paged` 按使用者集合分页；两种布局都复用共享图片和帧缓存。
5. **保留行为时间轴。** `frameMap` 仍有原来的长度；时长、帧号、循环阶段、移动进度与道具触发点保持原样。多个逻辑帧可以指向同一个图像姿态。

误差测量以 96px 身体高度、透明区域之外的预乘 RGBA 为基准，数值范围为 0–255；头部区域另外约束。它是可重复的像素约束，不是所有设备、尺寸上的人眼质量保证。平衡档姿态替换的平均误差上限为 2，头部为 1；计入减色后平均和头部上限均为 4。紧凑档分别放宽到姿态平均 4、头部 2，以及最终平均/头部 6。完整阈值和最大实测误差写入报告。

## 运行时与导出

优化包需要本仓库新增的 `tileRects` 与 `tileSampling` 支持，不能直接交给旧版播放器。`tileRects` 保存裁剪后像素的位置；`tileSampling` 保存原始栅格范围，在帧缓存中还原透明边界再缩放，避免裁剪造成边缘采样变化。它们是可选字段，旧清单仍可直接使用。图片保持 PNG，兼容现有 Web 与微信资源加载接口。npm 包只包含 SDK 代码与内置首屏素材，优化目录不被自动打进 npm 包；大型运行图集通过下面的命令独立导出。

```sh
npm run export:optimized-assets -- /path/to/hosted/pet
```

这会核对校验和，导出全局清单、引用的 PNG 和原音频。优化导出使用独立空目录；后续可原子替换它自己生成的目录，清除过期图集，不会把新旧版本 PNG 累积在一起。含其他文件的非空目录会被拒绝。不要直接修改图集却不更新 MD5、尺寸与清单。独立导出宠物子集可执行 `npm run export:companion-assets -- --optimized /path/to/hosted/companion`。

Web 接入示意：

```js
const pet = Pipi.createWebPet(canvas, { assetPack: '/pet' });
await pet.ready;
await pet.play('wave');
// 离开页面时：pet.destroy();
```

全局根清单含基础与宠物资产及宠物动作定义。输出中的 `engine.json`、`companion.json` 是子集视图，引用同一目录的共享图集，不应连图片各复制一份后再宣称共享节省。微信同样使用 `createWechatPet(canvasNode, wx, { assetPack: 'https://cdn.example.com/pet' })`，远程资源域名需配置到小程序允许的域名中；本轮不宣称已完成微信真机性能验收。

## 验证

```sh
npm test
npm run test:optimizer
npm run test:types
npm run test:optimized:browser
npm run test:optimized:browser -- --profile exact
npm run test:optimized:browser -- --profile compact
.venv/bin/python scripts/check-companion-browser.py --logic-only --optimized
```

每次生成都会从输出 PNG 重新提取并检查所有逻辑帧，检查 protected 姿态像素、近似误差、清单时长、帧映射和页面校验信息。Python 单测另用跨目录、不同位置的相同姿态证明全局共享，并测试构建失败不覆盖有效输出。

浏览器检查使用固定的优化前渲染器作对照，逐帧比较 1,849 个逻辑帧，并核对 28 个动作计划的时长、阶段、位移与缩放；截图与报告在 `test-results/optimization/`。原始采样范围还原后，无损档在本机 Chromium 的该项逐帧比较中像素差为 0。平衡/紧凑档有受限视觉差异，可在同步预览页自行查看。

## 使用本机 tinyimg 继续压缩

运行 `npm run compress:assets`，从已有单图包 `dist/optimized-assets/` 生成独立的 `dist/optimized-tinyimg/`。它不重新做姿态搜索，不覆盖原包。工具优先使用 `TINYIMG_BIN`、PATH 中的 `tinyimg`，或相邻 `tinypng/dist/static/tinyimg-static`。也可传 `-- --tinyimg /path/to/tinyimg --input /path/to/pack --output /path/to/output`。需要已有的优化 Python 依赖。

本机实测：

| 方法 | PNG 大小 | 比当前单图再减少 | 结果 |
| --- | ---: | ---: | --- |
| 当前全局优化单图 | 51.78 MiB | — | 保留用于对比 |
| tinyimg 无损 | 51.78 MiB | 0% | 工具回退到原文件 |
| tinyimg 默认直接压缩 | 11.80 MiB | 77.2% | 少数道具颜色偏差大，未通过逐帧阈值 |
| tinyimg + 区域保护 | 40.39 MiB | 22.0% | 通过当前逐帧检查，作为可选预览 |

区域保护保留原始 alpha 通道，并恢复全部关键帧、嘴部/翅膀补丁、站姿和道具像素。额外压缩误差超过阈值的物理帧也恢复原图。本次保护 198 个物理区域，额外回退 5 个，保留 1,222 个压缩区域；动作元数据完全不变。误差以压缩前的图集为基准，在 96px 身体高度的预乘 RGBA 上限制平均/头部误差不超过 3、较大误差像素占比不超过 1.5%。它不是所有尺寸下的感知无损保证，放大时仍可看到颜色渐变损失。

浏览器已对照制作素材检查 1,849 个逻辑帧、28 个动作计划；另外用实际 Demo 验证一次图片请求后断网播放六个按钮动作。图集尺寸仍为 8448×7995，RGBA 像素内存仍约 258 MiB，压缩只降低传输/文件体积。

对比预览：`http://本机IP:8765/examples/sdk-demo/?assets=tinyimg`。SDK 接入只需将 `assetPack` 指向 `/dist/optimized-tinyimg`（或你的托管目录）。重新生成基础包后，再运行一次压缩命令；新文件名、MD5、字节数及全部子清单会同步更新。输出目录必须为空或由此命令生成，失败会保留旧包。

三版同步对比页：`http://本机IP:8765/examples/tinyimg-comparison/`，并排展示当前单图、tinyimg 原始压缩和受保护压缩。支持动作切换、自动循环、统一时间轴、前后翻帧、112/132/216px 尺寸与深浅背景。当前直接压缩样本位于 `test-results/tinyimg/auto.png`，对应独立清单 `dist/optimized-tinyimg-raw/manifest.json`；它只用于对比，不是默认运行包。

## 每张序列帧分别用 tinyimg 压缩

```sh
npm run compress:frames -- --keep-frames
```

此命令读取原始基础运行素材及扩展素材（包括引擎内嵌首屏图），裁掉无效透明边缘，对 1,452 张不同的物理帧逐一运行本地 tinyimg，再按动作/共享关系打包为小图集。没有跨帧近似替换，不改变逻辑帧数、帧时长或位置。它是有损的颜色及 alpha 压缩，不宣称透明通道像素完全一致。原始素材保留；构建前后核对原始文件 SHA-256，失败不替换已有有效输出。

本次统计：原始运行库 PNG 共 64.50 MiB；逐帧压缩并重新打包后为 **44.70 MiB**，减少 **30.7%**。覆盖 52 个资源、1,849 个逻辑帧。独立帧 PNG 合计 **16.45 MiB**；重新合成图集后，部分页面无法继续使用每帧自己的 256 色调色板，必须用真彩色 PNG，因此合并后体积会上升。不能用独立帧体积冒充 SDK 图集体积。

- SDK 小图集包：`dist/optimized-tinyimg-frames/` 根目录的清单与图集，首屏只加载两张必要图片，其余按动作加载。
- 独立压缩帧：加 `--keep-frames` 后生成 `dist/optimized-tinyimg-frames/individual/`，带单独的 SDK 清单，方便查看或用于另一种加载方案。它会产生更多图片请求，未作为默认演示加载方式。该子目录是额外产物，部署小图集版时无需复制。
- 逐资源统计：`dist/optimized-tinyimg-frames/per-action-report.md`。部分原来已很小的动作在重新打包后会变大，表中如实显示负节省；共享图集不能跨行简单求和。
- JSON 校验和误差报告：同目录 `frame-compression-report.json`。
- 与原图同步对比：`http://本机IP:8765/examples/optimization/?profile=frames`。
- 实际按需加载 Demo：`http://本机IP:8765/examples/sdk-demo/?assets=frames`。

本机 Chromium 已检查 1,849 帧可见画面与 28 个动作计划：平均误差最差约 2.98（0–255 范围）、较大误差像素比例最差约 0.27%。逐帧调色板可能产生跨帧色彩差异，仍应在同步播放中判断是否接受。可用 `npm run test:optimized:browser -- --profile frames` 重跑。

## WebP 实测与构建

```sh
npm run compress:webp -- --keep-frames
```

默认质量为 82，可用 `--quality 90` 调整。输出 `dist/optimized-webp-frames/`，原图与 PNG 版本保留。与 PNG 的逐帧路线不同，默认 WebP 运行包直接从原始帧打包的小图集编码，只做一次有损压缩。可选 `individual/` 保存逐帧独立编码的 WebP，不用于默认 Demo。

| 路线 | 运行图片/独立图片总量 | 说明 |
| --- | ---: | --- |
| 原始运行 PNG | 64.50 MiB | 原始对照 |
| tinyimg 逐帧 PNG 后打包 | 44.70 MiB | 上一版 SDK 小图集 |
| 原始小图集直接编码 WebP | **15.63 MiB** | 比原始减少 75.8%，比上一版 PNG 小图集减少约 65.0% |
| 独立 WebP 帧 | 16.59 MiB | 与独立 tinyimg PNG 的 16.45 MiB 接近，请求数量更多 |
| WebP 帧解码后再无损合图 | 76.25 MiB | 实验结果变大，不采用；可用 `--webp-layout frame-repack` 复现 |

WebP 小图集首屏所需两张图片共 20,926 字节（约 20.4 KiB），不含脚本和清单。全部 1,849 帧透明通道、帧时长与偏移已核对；浏览器检查 28 个动作计划并测试六个 Demo 按钮。颜色有损，最坏画面平均误差约 4.22/255，较大误差像素占比最高约 2.82%，小道具和羽毛细节需要看对比判断。格式变小不会减少相同尺寸图片的 RGBA 解码像素量。

- 原图同步对比：`http://本机IP:8765/examples/optimization/?profile=webp`。
- WebP Demo：`http://本机IP:8765/examples/sdk-demo/?assets=webp`。
- 逐动作报告：`dist/optimized-webp-frames/per-action-report.md`。
- 复核命令：`npm run test:optimized:browser -- --profile webp`。

本次运行接入与验证范围为 Web/Chromium。当前微信文件缓存仍限定 PNG 文件名，WebP 包尚未接入微信端，不能直接以本次 Web 验证代表微信真机可用。

### 慢网络下的动作对比

`/examples/optimization/?profile=webp` 会分别显示两版图片的加载状态和等待秒数。
先加载好的版本立即循环预览；两版就绪后从第 0 毫秒重新同步，并启用时间轴。
加载失败时保留另一版预览，可以点击“重新播放”重试。暂停和拖动时间轴可以检查动作收尾，
不会因为动作只播放一次而错过短动作。

Web SDK 在替换或停止加载中的动作时会取消没有其他使用者的图片请求，避免快速切换积压下载。
共享图片仍由其他动作或启动素材使用时不会被取消；不支持 AbortController 的运行环境保留原有加载行为。
原图没有变小，网络慢时仍可能等待较久；只看动画可用 `/examples/sdk-demo/?assets=webp`，不同时下载原图。

启动 `npm run demo` 后，执行 `node scripts/run-python.cjs scripts/check-action-loading-browser.py`，
验证全部动作的实际画面变化、慢原图期间的预览、加载后同步、循环播放、失败重试和快速切换。

Web 图片采用可中止的 Fetch 流式下载，再从本地 Blob 解码。每收到一段数据都会更新字节进度：连续 15 秒没有新数据就中止请求；单次加载总上限仍为 120 秒。失败或超时后最多自动重试一次，重试使用新请求参数和 reload 缓存策略；
取消动作不会触发重试。可通过 WebAdapter 构造参数 `imageTimeoutMs` 调整单次总上限，`imageStallTimeoutMs` 调整无数据超时。
对比页另外限制每侧动作的总加载时间为 180 秒（包含重试与多张图片），超时会取消该侧下载并显示错误，
已经就绪的另一侧继续预览。点击“重新播放”可再次尝试。
运行 `node scripts/run-python.cjs scripts/check-image-timeout-browser.py` 可验证永久挂起请求的重试、
总超时、另一侧持续播放和手动恢复；测试使用浏览器虚拟时钟，无需实际等待三分钟。

对比页现在显示每侧动作所需图片的就绪张数（共享图片去重），例如 `8/9` 表示仍有一张未就绪。
Web 图片除 `load` 事件外，也通过缓存完成状态和 `decode()` 完成信号结束等待；取消与超时仍只结算一次。
动作首帧绘制成功后才返回 `ready`，页面在就绪和回到前台时主动唤醒播放循环。
`node scripts/run-python.cjs scripts/check-decoded-playback-browser.py` 使用真实图片下载、解码与渲染，
模拟缺失 `load` 通知，检查飞行、洗澡、跳舞和跳跃无需点击重新播放即可自动开始。

`node scripts/run-python.cjs scripts/check-jump-download-browser.py` 专门模拟开心跳跃第三张 WebP 请求挂起，验证 15 秒后自动重试、两侧自动开始播放，全程不点击重新播放。页面底部诊断日志版本为 `jump-trace-2`，`image-progress` 记录 request/downloading/decoding/ready/failed 阶段及已收字节；本机演示服务收集到 `test-results/demo-debug.ndjson`。

### 低速尾部与加载优先级

`jump-trace-3` 针对“每隔几秒只收到少量字节”的情况增加检测：首次请求大于 16 KiB 的图片，若 5 秒内新增数据不足 16 KiB，就中止并使用新请求重试。重试最多一次；第二次仍保留 15 秒无数据检测与 120 秒总上限，避免反复重下。

对比页先准备优化版，进入播放后再启动原图下载；切换动作时取消旧动作，尚未开始的原图请求不会再启动。原图仍可能很慢，但不参与优化版首播的网络竞争。

`node scripts/run-python.cjs scripts/check-jump-slow-tail-browser.py` 模拟跳跃第三张图先收到约 195 KiB、之后每秒仅 2664 字节，验证约 5 秒自动恢复，并断言原图请求在优化版开始播放后才发起。

当前单 WebP 预览验证：`node scripts/run-python.cjs scripts/check-webp-only-browser.py`。覆盖 27 个动作、暂停/继续、拖动时间轴和手机布局，并断言没有 PNG 图片及原素材目录请求。下文/前文的双侧同步说明属于保留的旧对比测试页面。

### WebP 后台预下载

完整预览页现在只播放完整下载、解码后的本地图片，并在首个动作就绪后单路预下载全库。提供文件数、MiB 进度以及暂停、继续和失败重试入口；切换动作和隐藏页面会中断后台任务，完成的压缩文件保留。优先准备当前动作后再恢复预下载。

增加 `pet.predownload(actions, { signal, onProgress })`。压缩文件缓存与解码缓存分开，64 MiB 的页面内缓存可容纳当前 114 张 WebP（16,393,686 字节）。不会把全库约 281 MiB 的解码像素同时加载进来。当前没有持久化文件缓存，刷新后重新检查下载。

浏览器回归 `scripts/check-predownload-browser.py` 验证：全库下载完成后断网、主动回收解码缓存，27 个动作均能继续播放，图片网络请求为零；模拟后台下载卡住时，选择当前动作会中断后台请求并自动播放。结果保存在 `test-results/predownload/browser.json`。

### 八方向预览与随机动作

完整预览页开放走路、飞行的八方向选择，原有 SDK 方向素材与行为一直保留，之前页面固定传入 `direction: 'e'`。其他动作不使用方向，方向选择器会禁用。

“随机动作”将 27 个可预览动作打乱，每个动作完整播放一次后切换，全部轮过后重新打乱，并避免跨轮连续重复。走路和飞行同时随机选择八方向之一；仍先完成下载与解码再播放。暂停、调速、时间轴继续有效，手动选动作、选方向或点击重新播放会退出随机模式；停止随机后当前动作恢复循环。页面隐藏期间不推进随机播放，加载失败时停止随机并显示错误。

浏览器回归 `scripts/check-random-directions-browser.py` 覆盖走路与飞行的 16 种组合、随机切换、暂停继续、时间轴暂停及手动退出。
