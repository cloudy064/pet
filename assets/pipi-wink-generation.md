# 俏皮单眼眨眼：素材与生成记录

使用内置 image_gen 工具，一次生成 16 个完整角色姿态。工具未暴露模型版本选择。原始输出已复制为 `pipi-wink-generated-poses.png`，用户参考图为 `pipi-wink-reference.png`。

参考图指定画面右侧闭眼、左侧睁开，并有轻微歪头和微笑。制作脚本 `../prepare_wink.py` 抠除生成稿的实色棋盘格背景，将各头部配准到实际静态图。眼部使用生成稿第 7、8、13 格的半闭、近闭与笑眼；嘴部使用第 5、6、13 格。保持笑眼时复用相同画面，完整眼部画面之间不透明叠化。眼部素材中下移的多余眉毛以邻近脸部底色修复，保留原角色眉毛及奶油色脸部轮廓。

身体和双脚使用固定静态图，头部作为完整位图围绕颈部轻转 5 度，再沿同一路径回正。颈部衔接使用原图躯干纹理。没有重新绘制角色或用通用光流变形瞳孔。

交付 `pipi-wink.png` 与同名 JSON：33 帧，每格 384×512，透明长图 12672×512，总时长约 1.707 秒。第 17 帧停留约 447ms，代替相同表情的重复帧；开头停留 100ms，末尾停留 160ms，其余帧为 30 fps。首尾对应当前 `pipi-idle.png`，该原图等比缩为 256×512，放在单格 x=64、y=0。`pipi-wink-validation.json` 保存透明边距、固定身体、首尾一致性和头部角度步长的检查。

## 最终提示词

Use case: identity-preserve. Asset type: transparent PNG sprite atlas of a friendly single-eye wink for a children's 3D toy parrot.

Input Image 1 is the EXACT character identity and neutral pose: Pipi green parrot, its precise head and body proportions, crest, cream face, orange beak and orange feet, blue/yellow/green folded wings. Input Image 2 is the desired middle expression, NOT a new identity: the eye on the VIEWER'S RIGHT is closed in a happy arched wink, the viewer-left eye stays open and looks at us, beak smiles open, slight friendly head tilt. Ignore every word, number, panel background, card edge and orange decorative marks in Image 2.

Create ONE atlas with EXACTLY 16 complete parrot drawings in an exact 4 columns by 4 rows grid, equal cells, read row by row. Prefer 2048x2048 pixels. GENUINE transparent alpha background, no painted checkerboard. Every cell has identical camera, scale, foot baseline and body placement. Complete crest, feet, folded wings and tail stay inside each cell with generous margins. No labels, no text, no grid, no floor shadow.

This sheet is ONE slow transition from the exact neutral of Image 1 to the happy wink of Image 2; do NOT return to neutral on this sheet. Two feet remain planted and absolutely unchanged, torso and folded wings remain absolutely unchanged, both wings stay DOWN against the body. No greeting wing raise. Preserve Image 1, especially its round large eyes and oval face. Head gradually tilts only FIVE degrees clockwise as seen on the image, toward the winking viewer-right eye, with a stable neck pivot. Not a sideways camera turn, no size changes, no head bobbing, no body squash.

Cell 1: exact neutral, both eyes open, beak closed.
Cells 2-4: begin the small head tilt, both eyes remain fully open, subtle smile.
Cells 5-7: gentle small beak opening, viewer-right upper eyelid begins to lower while viewer-left eye stays fully open.
Cells 8-10: viewer-right eye progresses clearly through half-closed and almost closed, never two pupils or a superimposed eyelid; cheerful smile opens slightly more.
Cells 11-13: viewer-right eye reaches a single clean happy upward-curved black wink line on cream skin, matching Image 2. The viewer-left eye stays exactly the same open eye. Complete the subtle head tilt.
Cells 14-16: settle at the happy wink and moderate open smile, all three final poses almost identical and stable.

Every cell must be a sharp coherent independently rendered pose. Maintain the exact same feather count, feet, crest shape, cream face boundaries, open-eye shape and highlights. Closed eye must become a happy arch like Image 2, not a drooping frown or a green rectangle. No crossfades, no ghosted open eye under the closed lid, no blur, no jitter, no rough edges, no props or sparkles. Natural soft dimensional toy shading matching Image 1.
