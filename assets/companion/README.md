# 新宠物动作包

已交付 16 个动作、538 个逻辑帧、19 张透明分页 PNG，以及 2 首原创数数歌的合成歌声示例。入口为 `manifest.json`；本目录按需加载，不随基础引擎自动下载。网页体验在 `examples/companion/`，逐帧检查在 `examples/companion/animations.html`。

动作：点头、睡觉、伸懒腰、吃葵花籽、洗澡、挠痒、鸟吻、理毛、单脚站立、转眼观察、跳舞、原地扑翅、喷嚏、打嗝、害羞小插曲、磨嘴。睡觉、洗澡、单脚站立、扑翅使用进入/循环/退出段，支持 `sustain:true` 与自然 `release()`。

## 文件与来源

- `source/`：16 套未改写的生成原件（每套 4×4 图格），原始提示词、哈希和分镜顺序。姿态由内置 `image_gen` 生成，参考 `assets/pipi-idle.png`。
- `masters/`：已去底、脚底对齐的透明关键姿态母版；另有葵花籽与木桩道具轨道。
- `runtime/`：引擎分页图集。虚拟画布为 320×256，脚底锚点 `(160,244)`，身体高度基准 216；身体与道具分别紧裁剪，清单保留虚拟坐标。
- `contacts/`：16 张深浅背景关键姿态接触表，供查看表情、羽毛和透明边缘。接触表不是运行清单。
- `manifest.json`：实际帧映射、每帧时长、分段、喂食阶段标记和独立道具配置。
- `build.json`：原件/母版/分页哈希、缩放和 RGBA 解码字节估算。`validation.json` 为文件实检结果。
- `audio/`：中英文原创词曲、MP3、逐字音符配置与哈希。歌声由 eSpeak NG 和 WORLD 合成，并非真人演唱。示例可替换成业务自己的录音。

## 制作方法

用户已明确授权本地脚本清理、裁切和打包。点头/睡觉原件的棋盘背景按与外缘连通的中性色区域去除，其他动作做洋红键控；扑翅的偏移白色分格线在裁切前检测并清除。边缘颜色向内部取样，保留软透明边缘。原件从未覆盖。

所有姿态以脚底配准；每套使用统一尺度以保留低头、下蹲和舒展。动作首尾使用原站姿像素。相邻新姿态补充单侧光流过渡，不叠化两个身体或两副翅膀。15 个动作各 33 帧，单脚站立按回正姿态重新编排为 43 帧；最终帧数按实际观感调整，分镜表中的数量是初始预算。

吃籽与磨嘴采用 `companionClip`：身体和道具按相同帧号播放。`pet.play('eatSeed', {effects:false})` 可以关闭道具且不申请道具图集。洗澡的香皂、泡泡和水流由示例的独立 Canvas 层绘制。新头部姿态均设置 `allowSpeech:false`；歌声示例使用现有可匹配嘴部的 `talk`。

## 重建、验证与导出

在 Python 环境安装 `requirements-companion-assets.txt` 后：

```sh
python scripts/build-companion-assets.py
python scripts/check-companion-assets.py
python scripts/check-companion-browser.py
npm run export:companion-assets -- /path/to/hosted/companion
```

浏览器检查另需 `requirements-browser.txt` 与 Playwright Chromium。素材导出同时校验 MD5/SHA-256，包含清单、运行图集与歌曲，不拷贝生成原件和制作母版。图片遵循仓库已有 Git LFS 规则。

音频重建另需 `requirements-companion-audio.txt`、`espeak-ng`、`ffmpeg`，运行 `python scripts/build-companion-audio.py`。词曲与音高配置保留在脚本和 `audio/catalog.json`；WORLD 声码器输出可能有随机噪声差异，重建后目录会记录新的音频哈希。

当前 PNG 下载合计约 25.0 MiB，单个动作全部分页最大解码约 6.54 MiB；最大分页边长 1610。缓存按需加载并受引擎预算控制。文件大小与解码估算不代表设备进程的峰值内存。实际验证及微信真机边界见 `docs/PET_COMPANION_VALIDATION.md`。

洗澡素材的第 9–11 个源姿态有翅膀跨过四等分格线。构建时改为在整张键控图中分离 16 个完整连通鸟形，
再进行配准和补帧，避免把相邻姿态的羽毛裁入收尾帧，也避免裁掉展开的翅膀。
源文件 `source/bath-v1.png` 保留原样；`python scripts/build-companion-assets.py --action bath`
只重建洗澡运行 PNG、派生母版及清单。之后执行 `npm run compress:webp -- --keep-frames` 更新 WebP 包。
