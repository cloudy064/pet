# 眨眼横向序列图草稿

文件：pipi-blink-strip-draft.png

使用内置 image_gen 生成。2172×724，单行 6 帧，每格 362×724。检查结果为 RGB，没有 alpha 通道，棋盘格是图片像素，因此尚不满足透明 PNG 要求，未接入正式调试台。

生成提示词：

Create a production animation sprite strip PNG with genuine transparent alpha background. Use attached image 1 as exact character identity and FRONT FACING standing pose reference; image 2 as supporting high-quality feather/material reference only. Pipi is the adorable green baby parrot with cream face, yellow orange beak, cyan blue large eyes, colorful folded wings and orange feet. Output ONE very wide horizontal strip, 6 equal-width cells in ONE ROW, preferably 3072x768. Each cell contains the same full-body front-facing character, same pixel height and foot baseline and centered within its cell, transparent margin all around. Frames left to right: 1 eyes fully open, 2 upper eyelids half down, 3 both eyes fully gently closed, 4 both eyes fully gently closed (identical to 3), 5 eyes half reopening (identical to 2), 6 eyes fully open (identical to 1). Only eyelids change; head, body, mouth, wings, feet, lighting, proportions and camera remain perfectly consistent. Natural dimensional cream feather eyelids, softly curved closed eyelid line, keep original cute richly rendered 3D cartoon style. No body movement. No text, no numbers, no borders, no labels, no background, no ground plane, no cast shadow, no checkerboard painted into pixels. Must be an actual transparent PNG sprite sheet. Do not make a contact sheet or multiple rows. Full head crest and feet visible in every frame.

第二次尝试要求仅移除背景、保留六个角色，输出仍是 RGB，无真实透明通道。

后续经用户明确授权，使用 `prepare_blink.py` 进行本地透明背景处理，最终文件为 `pipi-blink-strip.png`。模式 RGBA，2172×724，Alpha 范围 0–255，834469 个完全透明像素。原 RGB 角色像素保留，边缘 Alpha 轻微收紧以去除棋盘格污染。已经接入调试台，替代程序绘制眼睑。
