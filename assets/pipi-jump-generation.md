# 开心跳跃素材生成记录

日期：2026-09-10。使用内置 `image_gen.imagegen` 工具；没有使用 CLI/API 回退。工具未返回可核实的模型版本号。

输入：`pipi-idle.png` 为角色身份与首尾姿态；`pipi-jump-reference.png` 为用户提供的开心跳跃中间态参考。原始生成图保存在 `pipi-jump-generated-poses.png`，含 16 个展翅与收脚姿态。生成结果包含实色棋盘格，制作脚本已将它清除，最终 PNG 使用真实 Alpha 透明背景。

`prepare_jump.py` 提取各姿态并对齐头部，输出 `pipi-jump-registered.npz`、配准记录和检查图。`pack_jump.py` 使用原始默认姿态与生成图第 2、3、5、7、11 格（从 0 开始计数）构成连贯展翅路径，回程复用相同图像。对齐身体长度与着地脚底后，以双向光流补充翅膀和腿部过渡；脚部单独估计运动，轮廓通过距离场形成单一 Alpha 边缘。头部使用原始图像，表情复用已确认的 `pipi-pet.png` 生成素材，先根据该动作记录撤销头部位移与旋转，再取面部内部像素，不叠化瞳孔。

跳跃轨迹、轻微倾斜、起跳蓄力和落地压缩都已烘焙在长图内，播放器直接逐帧播放。手、文字、卡片、地面阴影和运动线不包含在 PNG 中。

最终输出：

- `pipi-jump.png`：26656×640，RGBA，49 个 544×640 的等宽帧。
- `pipi-jump.json`：逐帧坐标、时长、共同地面锚点、动作阶段与来源。
- 总时长约 1.787 秒，首帧 80ms、尾帧 140ms，其余约 33.33ms。
- 首尾都是现有默认 PNG 等比缩放为 256×512 后放在单帧 (144,96)，逐像素一致。
- 为双翅和腾空位移留出额外画布，最小透明边距为左 76、上 55、右 57、下 103 像素。

检查图见 `pipi-jump-check.jpg` 与 `pipi-jump-detail-check.png`；素材检查记录见 `pipi-jump-validation.json`。浏览器结果保存在工作区的 `player-check-result.txt`、`jump-playback-performance.json` 和 `jump-preview.png`。播放计时检查不能代替对动作自然度和羽毛细节的视觉判断。

本次浏览器检查通过 1336 项，实际播放采到全部 49 帧，无跳帧；七个动作的导出、首尾和计时检查通过。播放器按相同的角色矩形绘制首尾静态帧，消除了额外透明边距引起的缩放取样差异。

## 完整生成提示词

```text
Use case: identity-preserve.
Asset type: a single coherent animation pose atlas, exactly 16 full-body parrot sprites in a 4 by 4 grid, genuinely transparent background.
Image 1 is the strict original character identity and neutral pose. Image 2 is the desired joyful jump peak pose: both colorful wings broadly fanned outward and upward, toes lifted and legs bent, BOTH eyes smiling closed, open happy parrot beak.
Make ONE continuous transition from the resting pose to this happy airborne pose, reading left to right then top to bottom. Cells 1-2: neutral with folded wings and feet together. Cells 3-5: both wings begin unfolding outward, slight ready-to-jump crouch. Cells 6-9: wings progressively spread out to both sides, ankles extend then toes start lifting. Cells 10-12: both wings beautifully fanned like reference 2, feet tuck upward naturally and slightly forward, eyes close into joyful arches and lower beak opens. Cells 13-16: fully spread happy jump pose with bent legs, two distinct orange feet and clean smiling closed eyes. Natural asymmetric foot angle as in reference 2, still front-facing.
For extraction, keep head center, head size and torso center in exactly the same place in every equal square cell: vertical jump travel will be animated afterward. Keep front-facing camera, fixed lens, identical scale and lighting. Head remains upright; only wings, legs, eyes and lower jaw change. Preserve character's exact face proportions, 3 crown feathers, cream cheek patches, emerald/lime plush green body, bright cyan-blue and yellow layered feathers, glossy orange upper beak, two orange feet. Consistent feather count and attachment to shoulders. Wings must grow outward through intermediate poses, not appear suddenly. Legs and feet remain attached to the body.
Keep every sprite entirely within its own cell with 12 percent empty margin on every side, no touching adjacent sprites, no cut-off wing tips, crown or toes. Each cell has the same scale. High quality soft three-dimensional toy illustration, clean smooth edges. Ordinary natural beak opening/closing, NO rounded O mouth and no lips.
No captions, numbers, card, hearts, streaks, motion lines, floor, cast shadow, props or background from image 2. Transparent character sprites only.
```
