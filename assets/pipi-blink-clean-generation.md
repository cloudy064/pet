# 清晰眨眼素材

由内置 image_gen 生成 12 个独立开合姿态，再通过经用户授权的本地图片处理抠图、对齐和复制完整眼部区域，顺序闭合再反向睁开，组成 24 帧透明 PNG。原稿 pipi-blink-clean-keyposes.png；最终 pipi-blink-clean.png，每格 362×724。制作入口 repair_animation_assets.py。

瞳孔与眼睑区域直接取清晰姿态，不再交叉混合两种开合状态。固定底图保持不动，外侧脸部的窄边界作接缝处理。配套 PNG / JSON 已接入播放器。

## 最终提示词

Produce a clean sprite atlas of TWELVE eye-closing stages for the exact cute Pipi green parrot in the reference. 4 columns by 3 rows, ONE full-body character per equal-size cell. Keep exact front-facing identity, feather colors, cream face, yellow beak, fixed body, wings, feet, smile and lighting. Only the TWO upper eyelids move downward. Row-major sequence: 1 fully open; 2 10% closed; 3 20%; 4 30%; 5 40%; 6 50%; 7 60%; 8 70%; 9 80%; 10 90%; 11 95%; 12 fully closed. Upper eyelids have the same cream material as the face. Each eye has exactly ONE sharp pupil, ONE iris, ONE eyelid edge. Eyelids physically occlude pupils, do not fade pupils through translucent eyelids. No ghosting, no crossfades, no double eyelid outlines, no motion blur. When fully closed, no iris or pupil visible. Identical body, head angle, feet positions and scale in every cell. Entire crest and feet visible with margin around each sprite. Solid uniform neutral gray background #CCCCCC for extraction. No checkerboard, no words, no numbers, no gridlines or labels. High quality softly rendered 3D cartoon, sharp opaque eye details. Preserve the reference appearance.
