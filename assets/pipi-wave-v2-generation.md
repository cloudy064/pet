# 打招呼改进版

内置 image_gen 生成 16 个关键姿态，随后使用经用户授权的本地图片处理方式抠除背景、按统一比例缩放、对齐脚底，拼成 41 格透明长图。PNG 每格 576×724，锚点 (365,620)，左侧最少透明边距 42px。

最终来源：pipi-wave-16-keyposes.png。早期光流中间帧因羽毛重影已弃用。运行 prepare_wave_v2.py 后生成 pipi-wave-v2.png 与对应 JSON；运行 build_asset_registry.py 更新播放器注册表。

## 最终生成提示词

Extend this eight-pose parrot wing lift reference into SIXTEEN incremental animation poses, one character per cell in an exact 4 columns x 4 rows grid. Keep the same Pipi identity, same green/cream/blue/yellow/orange materials, same face smile, same open eyes, front-facing stationary torso and same foot placement. Full body including crest and feet in every cell, ALL wing tips visible with generous empty margins, no overlaps between cells. Read sequentially left-to-right, top-to-bottom. The wing on VIEWER LEFT must rise continuously with small steps from folded downward in cell 1 to high and fully fanned in cell 16. Spread the motion EVENLY over all 16 cells: row1 wing begins down and unfolds to 25 degrees from vertical; row2 lifts from 30 to 65 degrees from downward vertical; row3 lifts from 70 to 110 degrees (across horizontal); row4 lifts from 115 to 150 degrees from downward vertical. Every pose is a sharp, fully rendered new solid wing position, never transparent ghosting, doubled wings or motion blur. The viewer-right wing stays folded. Match head and body placement, height and size exactly across the grid; only viewer-left wing should move. Uniform neutral light gray background #CCCCCC with no textures, no checkerboard, no floor, no cast shadows. No words, numbers, borders or dividers. Prioritize smooth incremental wing angles and crisp solid feathers, production animation keyframes. Large square atlas.
