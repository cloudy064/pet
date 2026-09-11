# 飞行动画生成记录

## 保存位置与处理方式

四次调用均使用内置 image_gen。生成原图已从 Codex 生成目录复制到当前项目：

- `pipi-flight-front-generated.png`：输入 `pipi-idle.png`、起飞参考卡、落地参考卡。
- `pipi-flight-side-generated.png`：输入 `pipi-idle.png`、飞行中参考卡、第一张正面图集。
- `pipi-flight-flap-generated.png`：输入 `pipi-idle.png`、第一张正面图集，补充上下扑翼姿态。
- `pipi-flight-turn-generated.png`：输入 `pipi-flight-front-turn-source.png` 与 `pipi-flight-side-turn-source.png`，补充连续转身姿态。

原始输出含可见棋盘底，经 `prepare_flight.py` 去背景、保留浅色脸部、对齐和清理边缘；`pack_flight.py` 进行动作补帧、稳定扑翼时的头部与身体，生成七组真正透明的横向 PNG 及同名 JSON。正面起飞与落地的眼睛使用完整的原有表情素材，首尾采用实际默认图；转身使用补充生成的连续侧脸。角色的舞台移动在控制器中完成。不同朝向切换到共同翼拍姿态后使用独立转身长图，不直接翻转正在显示的正面帧。

交付文件前缀为 `pipi-flight-`，七个片段为 `takeoff`、`hover`、`right`、`left`、`turn-right`、`turn-left`、`land`。统一单格 704×576，完整配置是 `pipi-flight.json`。所有完整提示词如下。

## 转向补充连续姿态

```text
Use case: stylized-concept
Asset type: natural 3D parrot turning animation sprite atlas.
Reference roles: image 1 is the approved front-facing hover with spread wings and tucked feet; image 2 is the approved right-facing flight identity and posture.
Create exactly NINE isolated full-body birds in a strict 3-column by 3-row grid, reading left to right then top to bottom. This is a SINGLE VERY SMOOTH TURN from front view toward viewer RIGHT. One transparent background, no text, numbers, cards, marks or shadows. Leave generous padding so all feather tips and toes are visible and birds never overlap.
Every bird has both wings held horizontally, orange feet tucked under the belly, same fixed body/head center and same head HEIGHT. Same soft high-end 3D camera, green/yellow crest, lime green body, cream face patches, glossy teal eyes, orange hooked beak, green/yellow/blue feather wings.
The nine yaw angles are approximately 0, 5, 10, 15, 20, 25, 30, 35 and 40 degrees toward viewer RIGHT. First pose looks straight at the camera with closed natural beak. Over the sequence the hooked beak opens gently into a small happy smile matching image 2. Do NOT make an O-shaped mouth. Both eyes remain open and anatomically consistent as the far eye narrows in perspective.
All poses MUST be different, with evenly advancing subtle turns, not three repeated rows or abrupt flips. Rotate the body in 3D together with head. Tail gradually becomes visible behind the body toward the left, toes naturally turn with body. No wingbeat in this atlas; wings remain at the horizontal mid-stroke. Same physical head size and same center in every grid cell, no zoom or bobbing. Preserve polished soft textures and clean single contours, no ghosting.
```

## 正面扑翼补充中间姿态

```text
Use case: stylized-concept
Asset type: full-body 3D mascot front-facing wingbeat keyframes, transparent sprite atlas.
References: first image is exact neutral Pipi identity; second image is previously generated front flight artwork, retain that natural anatomy and rendering.
Make exactly EIGHT full-body birds in a strict 4-column by 2-row grid. Genuine transparent background. NO words, cards, numbering, marks, shadows, floor. Large gaps and complete feathers within every cell.
All eight show the SAME front-facing hovering parrot: identical head/crest/face size and position, same plump green belly, same tucked orange feet, same camera and lighting. Head never tilts; body never bobs. Big open teal eyes, closed natural hooked orange beak (no round mouth), cream cheeks, crown. ONLY the wings change, naturally articulated at the shoulder with flexing blue primary and yellow secondary feathers, green shoulders.
Row 1:
1. Wings exactly horizontal, feather fans extend outwards.
2. Both wings lifted about 25 degrees above horizontal, full feather fans.
3. Both wings lifted about 50 degrees above horizontal.
4. Both wings at their highest 75 degrees above horizontal, a wide V with curved feather tips.
Row 2:
5. Wings horizontal again, feather tips curve downward during power stroke.
6. Both wings 25 degrees below horizontal, blue primary feathers naturally bend and overlap.
7. Both wings 50 degrees below horizontal.
8. Both wings 75 degrees down, beside belly, tips below tucked feet, still fanned, not folded.
Do not enlarge or shrink any bird. All heads must have identical dimensions. Smooth polished high-end soft 3D rendering matching reference, no blur or ghost contours. Exactly two wings and two tucked feet, no extra anatomy.
```

## 侧向扑翼与转向姿态

```text
Use case: stylized-concept
Asset type: transparent 3D mascot flying sprite key-pose atlas.
Reference roles: image 1 defines exact Pipi identity, colors and proportions; image 2 defines the natural three-quarter right-facing flying pose; image 3 is the approved front-facing flight pose atlas, match its scale and lighting.
Create a strict 3-column by 3-row grid of exactly NINE isolated full-body parrots. Large clear padding between birds, no overlap, no clipped crest/wings/tail/feet. Transparent background, no floor/shadow, no clouds/text/cards/motion marks.
Rows 1 and 2: Six consecutive wingbeat key poses of the SAME parrot flying toward viewer RIGHT, THREE-QUARTER view matching image 2. Body is gently leaned forward, both feet tucked behind/below belly, small tail streaming left, bright open eyes, slight happy naturally open hooked beak (NOT a round O mouth).
Pose 1: wings extend broad horizontal.
Pose 2: wings rise halfway above shoulders.
Pose 3: wings highest in a broad high V, feathers flex naturally.
Pose 4: wings sweep down through broad horizontal.
Pose 5: wings sweep below shoulders, both wings still visible, blue primaries flex.
Pose 6: wings lowest alongside belly, naturally curved, not folded away.
CRITICAL LOCK: Across these first six poses keep head, torso, feet and tail IDENTICAL in position, shape, scale, facial expression and perspective. ONLY articulate the wings. Identical camera throughout. Do not bob the bird or change beak shape.
Row 3: Three turn-in-place transition poses, wings horizontal and feet tucked at identical height and body center, using the same character:
Pose 7: facing exactly front toward camera, symmetrical face and body, wings horizontal.
Pose 8: slight turn 15 degrees toward viewer right, wings horizontal.
Pose 9: turn 30 degrees toward viewer right, nearly reaching the three-quarter flight view from pose 1, wings horizontal.
Keep vivid lime green body/crown, cream cheeks, orange hooked beak/feet, teal irises, green shoulder/yellow secondary/cyan and deep blue primary feathers. Full anatomy, plump body, soft high-end 3D shading, clean feather contours. Each head same size. No motion blur.
```

生成方式：内置 image_gen（未调用 CLI 或外部 API）。以下为完整提示词。用户给定起飞、飞行中、落地三张参考卡，默认站姿来自当前项目。

## 正面起飞、扑翼、落地姿态

```text
Use case: stylized-concept
Asset type: high-quality 3D parrot animation key-pose atlas for transparent PNG sprites.
Reference roles: image 1 is the exact Pipi character identity and neutral proportions. Image 2 is the crouched takeoff action reference. Image 3 is the landing expression and open-wing reference.
Create ONE atlas with exactly 12 isolated FULL BODY birds in a strict 4-column by 3-row grid, read left to right then top to bottom. Transparent background, no shadow, no text, no numbering, no cards, no motion marks. Plenty of transparent padding in every cell, wings never touch cell edges or other birds.
Keep the same front-facing camera, green/yellow crown, huge cream cheek patches, glossy teal eyes, orange hooked beak, chubby green belly, blue-primary/yellow-secondary/green-shoulder feather wings, orange feet, lighting and character scale across all poses. Every pose has one bird, 2 wings, 2 feet. Do not change head shape, feather colors or camera zoom.
Row 1 TAKEOFF:
1 Standing like the exact neutral reference, wings only slightly loosened, eyes open.
2 Low crouch, feet planted, focused eyebrows, wings half spread.
3 Deep athletic crouch matching takeoff reference, wings fully spread sideways, face forward, crest stays upright.
4 Leaving ground, legs tuck under belly, wings spread horizontally, eyes bright and curious.
Row 2 HOVER FLAP, body and head position identical across these four drawings, feet tucked identically, head forward, normal open eyes, beak nearly closed (never a round O):
5 Wings elevated in a broad high V, full curved blue feather fans.
6 Wings extend horizontally in a broad span.
7 Wings sweeping down below shoulder level, curved trailing primary feathers.
8 Wings fully down alongside belly, feather fans slightly swept outwards.
Row 3 LANDING:
9 Hover with wings fully horizontal, feet extended toward ground, happy crescent closed eyes and cheerful naturally open hooked beak.
10 Ground contact with both feet, knees compress, wings still fully spread, matching reference landing card.
11 Recover standing, wings halfway folded, happy crescent eyes.
12 Standing upright again, wings folded naturally, eyes reopening, beak gently closed.
Style: beautifully modeled soft 3D cartoon mascot, smooth clean feather edges, polished toy-like soft shading consistent with reference, not flat vector or mechanically rotated wings. Natural articulated wing anatomy. Entire crown, entire wings and every toe visible within each cell. Each bird has the same head size. Genuine alpha transparency.
```
