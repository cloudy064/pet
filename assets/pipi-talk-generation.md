# 说话动作：素材与生成记录

使用内置 image_gen 工具一次生成 16 个嘴型姿态；工具没有暴露模型版本选择。生成原稿保存为 `pipi-talk-generated-poses.png`，用户参考为 `pipi-talk-reference.png`。本次使用既有 `pipi-idle.png` 保持角色身份和默认姿态。

`../prepare_talk.py` 从图集提取角色并抠除实色棋盘格，先按头部、再按上喙宽度与顶点对齐嘴型。只把嘴部 RGB 合成到当前静态原图；双眼区域另加保护，避免引入新的瞳孔高光或眼睛轮廓。嘴角完整替换，外围脸部边界作空间过渡；相邻嘴型之间没有透明交叉淡化或光流变形。全帧 Alpha、头部轮廓、躯干、翅膀和双脚始终保持原图。

当前 v2 的 `pipi-talk.png` 为 32 帧、每格 384×512，横向长图 12288×512，总时长 1900ms。按用户修正，只使用鸟喙张开、合拢的 7 种完整嘴型，以开口幅度和停顿形成说话节奏；图集第 9–12 格（索引 8–11）的圆口嘴型已全部排除。此修改复用已有生成画面，没有重新调用图像生成工具。此素材是通用说话循环，尚未绑定具体语音。每帧停留时间见同名 JSON。

首尾与静态原图逐像素一致：将 `pipi-idle.png` 等比缩为 256×512，放在每格 x=64、y=0。透明边距为左 69、上 48、右 65、下 71 像素。`pipi-talk-validation.json` 验证首尾、嘴部之外像素、双眼及 Alpha 一致性。`pipi-talk-check.jpg` 是抽帧预览，`pipi-talk-mouths-check.jpg` 为嘴型库。

## 原始生成提示词（圆口部分已从当前动作排除）

Use case: identity-preserve. Asset type: 16 mouth poses for a natural talking animation of Pipi, a friendly 3D toy green parrot.

Reference Image 1 is the EXACT identity and neutral pose. Keep its round head, two large open turquoise eyes, eyebrows, cream face, large orange beak, green torso, three crest feathers, folded blue/yellow/green wings and orange planted feet. Reference Image 2 supplies the TALKING expression only: both eyes wide open, happy open beak with visible tongue and dark mouth cavity. Discard the card, words, number, borders, orange sound marks and background.

Create ONE exact 4-by-4 atlas with SIXTEEN complete characters in equal cells, read left to right and top to bottom, preferably 2048x2048. Request genuine transparent alpha background; do not draw checker squares. No grid lines, labels, text, ground shadow or decoration. Complete crest and feet inside every cell, generous clear margin. Maintain EXACTLY the same camera, head angle, head size, body position, face shape, pupil position and foot baseline in EVERY cell. Both wings are always down and folded, both eyes always open looking at the viewer. No wink, blink, head tilt, nod or body motion. ONLY the mouth changes.

This is a mouth-pose library with clear small intermediate openings for actual speech, not sixteen repetitions of one smile. Upper beak ATTACHMENT, nostrils and upper beak width stay fixed; the lower jaw opens and closes naturally from its hinge, revealing the dark cavity and small warm pink-orange tongue. No human teeth or human lips. Preserve the beak design of Image 1.

Row 1, cells 1-4: cell 1 EXACT Image 1 closed-beak neutral; cell 2 mouth barely parts, a thin dark slit; cell 3 small opening with lower jaw 20% lowered; cell 4 35% open relaxed speaking mouth.
Row 2, cells 5-8: gradually open from 45%, 60%, 80%, to the fully open friendly speaking expression of Image 2; retain original upper beak, reveal tongue clearly, never a scream.
Row 3, cells 9-12: a second speech vowel, gently rounded mouth: 60% open rounded, 45% rounded, 25% rounded, then barely parted rounded. It is still a PARROT beak, not fleshy human lips. Smooth tiny changes.
Row 4, cells 13-16: another friendly syllable, slightly wider speaking smile: small opening, medium opening, medium-large opening, then relaxed CLOSED Image 1 neutral. Only the lower jaw/tongue/mouth cavity changes.

All sixteen must be crisp complete naturally rendered poses, with smooth toy-material shading and precise antialiased edges. Strict identity/scale/lighting consistency. No face deformation, stretching upper beak into a new nose, duplicated outlines, transparent overlapping mouths, motion blur, ghosting or missing feather tips. Natural cheerful conversational expression, no teeth.
