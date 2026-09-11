# 好奇歪头素材生成记录

日期：2026-09-10。使用内置 `image_gen.imagegen` 工具；未使用 CLI/API 回退。工具没有返回可核实的具体模型版本号。

输入：`pipi-idle.png` 为角色身份与默认姿态；`pipi-curious-reference.png` 为用户提供的好奇歪头参考。原始生成结果已保存为 `pipi-curious-generated-poses.png`，包含 8 个轻微挑眉与小幅张嘴的表情姿态。生成结果带有实色棋盘格，制作脚本已清除；交付 PNG 采用真实 Alpha 透明背景，不包含问号、卡片、文字或地面。

`prepare_curious.py` 对齐生成素材，只提取轻微变化的左侧眉毛和鸟喙。上喙先对齐原图，双眼图像始终保留原始睁眼状态，奶油色额头边界也保持原样。以同一个头部图层做顺时针 16 度缓动侧倾，轻微下移 2 像素；观察停留后复用同一组姿态回正。颈部使用原图纹理，在原始身体后方补齐露出的区域；身体和双脚保持固定。没有对瞳孔做叠化，也没有使用逐帧生成的整只角色直接播放。

最终文件：

- `pipi-curious.png`：15744×512，RGBA；41 个 384×512 的等宽单元。
- `pipi-curious.json`：帧坐标、时长、脚底锚点、动作阶段和素材来源。
- 总时长约 2.127 秒：首帧 100ms、第 21 帧观察停留 600ms、尾帧 160ms，其余约 33.33ms。
- 21 种不同姿态组成往返动作；相邻帧不重复，观察停留通过计时表达。
- 首尾与现有默认 PNG 缩放到 256×512、放在 (64,0) 后逐像素一致。
- 最小透明边距：左 69、上 48、右 55、下 71 像素。

检查图为 `pipi-curious-check.jpg` 和 `pipi-curious-detail-check.png`；`pipi-curious-validation.json` 检查首尾、透明边距、固定身体区域、双眼图像及转角步幅。浏览器检查记录见工作区的 `player-check-result.txt`、`curious-playback-performance.json` 和 `curious-preview.png`。

颈部补片采用原图纹理和圆弧遮罩，放在原始身体后方，覆盖歪头露出的左侧连接区域；放大检查见 `pipi-curious-neck-check.png`。

## 完整生成提示词

```text
Use case: identity-preserve.
Asset type: ONE expression pose atlas with exactly 8 full-body parrot sprites in a 4-column by 2-row grid, genuinely transparent background.
Image 1 is the strict original character identity and neutral resting pose. Image 2 is the desired curious, attentive personality: a baby parrot wondering about something, big bright OPEN blue eyes, a gentle inquisitive face, very slightly parted natural golden beak, wings resting by its sides.
Make a subtle neutral-to-curious expression progression reading left to right, top row then bottom row. Cell 1 matches the original neutral expression. Cells 2-3: attentive look, viewer-left eyebrow lifts a little. Cells 4-5: slightly raised viewer-left eyebrow, a tiny opening of the LOWER beak. Cells 6-8: attentive curious look, same wide OPEN blue eyes, one eyebrow gently raised, lower beak just slightly parted in a friendly small smile. Keep the broad pointed upper parrot beak fixed; never a round O mouth, pursed lips, or a huge laugh.
IMPORTANT: Keep the head UPRIGHT and at exactly the same position in all 8 source cells. The head tilt from image 2 will be animated after extraction. Preserve identical original eye shape, pupil position, eye size, head proportions and silhouette; do not animate gaze or blinking. Only the eyebrow and small lower-beak expression change.
Lock the original fluffy lime-green torso, three crown feathers, cream cheeks and pink blush, cyan and yellow folded wings, orange feet, front camera, scale, soft 3D toy material, colors and lighting to image 1. Every body and both feet remain identical to the original rest pose. No wing raising.
Eight identical cell sizes, generous empty margins between sprites, all crowns and toes completely visible. Clean polished antialiased edges with real transparent alpha.
Do not include the question mark, captions, badge, numbers, card, other characters, ground shadow, motion lines, or background from image 2. Character-only sprites.
```
