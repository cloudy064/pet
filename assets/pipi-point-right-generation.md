# 画面右侧单翅指字制作记录

使用内置 `image_gen`，参考输入为 `pipi-idle.png`（固定角色、羽冠朝向和站姿）及 `pipi-point-reference.png`（已确认的画面左侧展翅，作为动作参考）。没有整只镜像角色。

生成原件：`C:/Users/cloudy064/.codex/generated_images/01a08a4d-ab61-74d0-b056-0953ca9e1e44/exec-16086def-2d20-4701-99e5-4276aac3e6cc.png`。项目内原件：`pipi-point-right-generated-poses.png`。

生成结果是六格 RGB 图片，背景实际为棋盘格，没有满足提示词中的真实 Alpha 要求。`prepare_point_right.py` 去除边缘连通的中性背景，按头部和脚底配准，采用第 2、3、4 格的右翅姿态。其余身体、头部、羽冠和双脚保持原默认图，避免整只抖动。局部光流与轮廓插值补齐展开的 19 种姿态，原路收回，共 37 帧；没有手工重新绘制角色。生成羽毛仍有少量纹理变化，可在指字调试台逐帧查看。

完整透明长图 `pipi-point-right.png`：17760×512，每帧 480×512；首尾为默认姿态。`pipi-point-right.json` 记录锚点、逐帧时长和动作阶段。运行图集由 `build_point_bundle.py` 无损打包。说话独立复用已确认的鸟喙张合素材，不生成圆口。

小程序只打包右翅变化区域，另配本地默认图、完整招手变化区域和鸟喙变化区域。这四个 PNG 是缩小后经 imagequant 256 色调色板量化的运行衍生图，**不是相对原图的无损压缩**；桌面原件、完整长图和原有 31 组无损运行素材均保留。

按顺序复现：

```text
python build_point_action.py
python prepare_point_right.py
python build_point_bundle.py
python build_miniprogram_welcome.py
python check_point_preview.py
```

依赖 Pillow、numpy、OpenCV，以及 `.tools/pyoxipng` 中的 pyoxipng 9.1.1、`.tools/imagequant` 中的 imagequant 1.1.5。

## 实际提交的提示词

```text
Use case: precise-object-edit. Asset type: transparent PNG sprite keyframes for the supplied Pipi parrot mascot's pointing animation. Input image 1 is the invariant neutral character identity, shape, face, folded wings, crest direction and orange feet. Input image 2 shows the already approved screen-LEFT wing pointing horizontally. Create its counterpart with ONLY the SCREEN-RIGHT wing (the bird's anatomical left wing) unfolding naturally to point to a word on the right. DO NOT mirror the entire bird: its asymmetric lime/yellow crest must keep exactly image 1's direction, and the face, head, torso, eyes, beak, feet and folded screen-left wing must stay unchanged and stationary. Output one clean 3-column by 2-row sprite sheet, SIX equal square cells read left to right then top to bottom, with generous transparent gutters. Every cell contains the identical complete full-body bird, standing upright front-facing, feet on the identical baseline, body the same size and same position within its cell. Sequence: cell 1 exact neutral with both wings folded; cell 2 screen-right wing barely lifts from flank; cell 3 wing opens diagonally downward partway; cell 4 wing midway toward horizontal; cell 5 nearly horizontally extended; cell 6 one broad feather fan extends horizontally SCREEN-RIGHT as a gentle 'look at this' presenting gesture, matching the fan design and colors of reference image 2 on the opposite side. The screen-left wing remains folded throughout. Lime-green shoulder feathers, yellow middle feathers, cyan and deep blue outer feathers, soft glossy 3D toy illustration shading identical to references. Both eyes stay open with calm friendly look, beak CLOSED in every cell, no speaking/winking because mouth animation is added independently. No bouncing, no leaning, no whole-body turn, no changing crest, no extra wing, no detached feathers, no hand or pointing finger, no arrows, no text, no frame numbers, no word cards, no ground/shadow. Require a genuine transparent alpha background (not a painted checkerboard), including between feathers. Make the transitions a coherent gradual unfolding, not six arbitrary poses. Keep every entire wing, crest and foot comfortably inside its equal cell.
```
