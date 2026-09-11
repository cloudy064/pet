# 抚摸反馈素材生成记录

日期：2026-09-10。使用内置 `image_gen.imagegen` 工具，未使用 CLI/API 回退。工具未提供可验证的模型版本号。

输入：`pipi-idle.png` 为角色身份与默认姿态；`pipi-pet-reference.png` 为用户提供的抚摸反馈表情参考。本动作保留角色自身，不将手、爱心或卡片背景烘焙进序列。

原始生成结果已复制为 `pipi-pet-generated-poses.png`。该图含实色棋盘格；`prepare_pet.py` 清除背景后，提取和对齐生成的双眼表情与鸟喙素材。保留原图身体、双翼、双脚及头部外形，以同一头部图层做 7 度缓动侧倾和 6 像素下移，避免生成图之间的位置与形体漂移。双眼使用完整表情替换，没有瞳孔叠化；保护原眉毛与奶油色脸颊边界，清理供体的绿色边缘侵入。

最终交付：`pipi-pet.png`（14208×512，RGBA），37 个 384×512 的等宽单元，`pipi-pet.json` 为配套计时、坐标、锚点和来源。正向 19 个姿态沿同一路径返回；中心停留用单帧 420ms 表示，首帧 120ms、尾帧 180ms，其余帧约 33.33ms，总长约 1.853 秒。首尾与当前默认 PNG 等比缩放后逐像素一致。

检查：`pipi-pet-check.jpg` 为抽帧预览，`pipi-pet-detail-check.png` 为放大检查图，`pipi-pet-validation.json` 记录首尾一致、固定身体、透明边距与运动步幅。实际浏览器检查输出位于工作区的 `player-check-result.txt`、`pet-playback-performance.json` 和 `pet-preview.png`。

## 完整生成提示词

```text
Use case: identity-preserve.
Asset type: animation expression atlas for an existing transparent sprite.
Create ONE 4 by 4 grid of exactly 16 full-body images of the SAME green baby parrot, on a genuinely transparent background, no text, no grid lines, no shadows on the floor.
Image 1 is the strict character identity and original neutral pose reference: preserve its exact green body, three crown feathers, cream cheek patches, blue eyes, golden parrot beak, yellow and blue folded wings, orange feet, materials, proportions, lighting, front camera and scale. Image 2 is ONLY a reference for the affectionate facial expression when petted: BOTH eyes turn into happy upward-curved closed arches and the bird smiles contentedly with a naturally open parrot beak.
Sequence reading left to right, top to bottom: cells 1-3 neutral eyes gradually relax; cells 4-6 both eyelids descend together, half-open intermediate poses; cells 7-9 almost closed then clean happy closed arches; cells 10-16 both eyes fully closed happy smiling arches, beak slightly opens then comfortably open happy smile, small visible tongue. Beak opens by lowering its lower jaw, retaining the broad pointed upper beak, NEVER a round O mouth or pursed lips. Upper beak unchanged.
Keep the head upright and almost at the same location in every cell, head tilt/dip will be animated after extraction. Keep body, wings, tail and feet absolutely in the same rest pose with feet at the exact same baseline in each equal-sized cell. Only eyes and lower beak expression change. Eye and beak shapes should vary coherently and subtly frame to frame, no dissolve, no duplicate pupils, no extra eyebrows. In the happy closed state, all iris and pupil pixels disappear and are replaced by cream skin and one clean dark eyelid arch per eye.
All 16 cells equal size, generous empty margins, complete crown and feet visible. Soft polished three-dimensional toy render, faithful to image 1, with no change in face layout or shading.
Do not include the hand, hearts, sparkles, text, numbered badge, card, background, other characters or props from image 2. Character only.
```
