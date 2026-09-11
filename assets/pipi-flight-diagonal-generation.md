# 斜向飞行生成记录

方式：内置 image_gen。左侧两个方向由对应右侧成品逐帧镜像，保留统一拍翼相位。

最终选择：两组新生成候选图已保存，但翅膀与身体比例发生变化，未纳入成品。四个斜向循环采用此前已稳定的 `pipi-flight-right.png` 32 帧，分别烘焙 ±22° 倾身并镜像；另外输出各 17 帧的倾身过渡。所有变化均已写入透明 PNG，播放端仅取帧，不旋转或变形角色。

## up-right

```text
Use case: stylized-concept
Asset type: Pipi parrot flight loop, transparent key-pose sprite sheet.
Image 1 is the identity reference. Image 2 is the established flight appearance: use its top-left bird as the exact size, face, colors, body shape and right-facing three-quarter camera reference.
Generate EXACTLY EIGHT full-body parrots arranged in a strict 4-column by 2-row grid, generous transparent space separating all feathers. Genuine alpha transparency, no painted checker, background, shadows, text, labels or motion lines.
DIRECTION: Flying diagonally toward UPPER RIGHT, body pitched 22 degrees nose-up. Beak and gaze lead to upper right, tail and tucked feet trail lower left. An energetic gentle climb.
Keep that exact three-quarter direction and body pitch in ALL eight poses. The head, eyes, hooked orange beak, torso, curled feet and trailing tail stay identical in scale, location and expression within each grid cell. Only the two feathered wings flap naturally from the shoulder. No whole-body wobble. One near wing projects toward viewer left; the far wing on image right is properly foreshortened. Both wings always attach to the body.
Eight consecutive wing phases, relative to the pitched torso:
1. Both wings spread level relative to the body, longest horizontal span.
2. Wings rise about 35 degrees, feathers fanned.
3. Wings raised about 70 degrees, elbows flex naturally.
4. Wings return halfway down from upper peak.
5. Both wings again pass through level.
6. Wings sweep down about 35 degrees, feathers overlap naturally.
7. Wings reach downstroke about 65 degrees, tips clear the tucked feet.
8. Wings rise halfway toward level, connecting seamlessly back to frame 1.
Lime-green plump baby parrot, huge cream cheeks, glossy teal eyes, yellow-green three-feather crown, small cheerful OPEN HOOKED beak with lower mandible, never an O mouth, folded orange toes, green/yellow/blue wing layers. Polished soft 3D toy rendering, clean complete feather edges with no blur or ghosts. Entire wings and tail must fit in every cell; keep at least 30 pixels transparent margin around the widest pose.
```

## down-right

```text
Use case: stylized-concept
Asset type: Pipi parrot flight loop, transparent key-pose sprite sheet.
Image 1 is the identity reference. Image 2 is the established flight appearance: use its top-left bird as the exact size, face, colors, body shape and right-facing three-quarter camera reference.
Generate EXACTLY EIGHT full-body parrots arranged in a strict 4-column by 2-row grid, generous transparent space separating all feathers. Genuine alpha transparency, no painted checker, background, shadows, text, labels or motion lines.
DIRECTION: Flying diagonally toward LOWER RIGHT, body pitched 22 degrees nose-down. Beak and gaze lead to lower right, tail trails upper left, feet remain tucked. A controlled gentle descent.
Keep that exact three-quarter direction and body pitch in ALL eight poses. The head, eyes, hooked orange beak, torso, curled feet and trailing tail stay identical in scale, location and expression within each grid cell. Only the two feathered wings flap naturally from the shoulder. No whole-body wobble. One near wing projects toward viewer left; the far wing on image right is properly foreshortened. Both wings always attach to the body.
Eight consecutive wing phases, relative to the pitched torso:
1. Both wings spread level relative to the body, longest horizontal span.
2. Wings rise about 35 degrees, feathers fanned.
3. Wings raised about 70 degrees, elbows flex naturally.
4. Wings return halfway down from upper peak.
5. Both wings again pass through level.
6. Wings sweep down about 35 degrees, feathers overlap naturally.
7. Wings reach downstroke about 65 degrees, tips clear the tucked feet.
8. Wings rise halfway toward level, connecting seamlessly back to frame 1.
Lime-green plump baby parrot, huge cream cheeks, glossy teal eyes, yellow-green three-feather crown, small cheerful OPEN HOOKED beak with lower mandible, never an O mouth, folded orange toes, green/yellow/blue wing layers. Polished soft 3D toy rendering, clean complete feather edges with no blur or ghosts. Entire wings and tail must fit in every cell; keep at least 30 pixels transparent margin around the widest pose.
```
