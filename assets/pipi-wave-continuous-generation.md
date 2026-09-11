# 连续轨迹打招呼素材

使用内置 image_gen，以 `wave-raised-inspect.png` 为参考生成单独的翅膀位图，保存为 `pipi-wing-motion-source.png`。随后进行用户已授权的本地抠图和序列拼接。没有通过代码绘制角色，也没有混合两张姿态做透明补帧。

`prepare_wave_continuous.py` 将同一个翅膀沿连续角度、大小和收拢轨迹变换，叠加固定的角色底图，离线烘焙为 96 帧。抬起和收回使用余弦缓动；中段轻挥两次。首尾图像相同，其他帧均有实际变化，共 95 个不同画面。

最终 PNG：`pipi-wave-continuous.png`，RGBA，32256×422；每格 336×422，96 格横排。默认 60 fps，总时长 1.6 秒。所有帧共享脚底锚点和相同画布，透明边距检查随制作脚本执行。`pipi-wave-continuous.json` 保存时长、边界、锚点、显示尺寸基准和运动轨迹。动作使用的收翅轮廓与旧版有差异。

## 最终生成提示词

Extract the parrot's raised wing on the VIEWER LEFT as a single standalone animation part. Preserve the exact same blue outer feathers, yellow middle feathers, green shoulder feathers, soft 3D material and feather design as the reference. ONLY ONE COMPLETE WING, no parrot head, face, torso, feet, eyes or other objects. Reconstruct the small green rounded shoulder/root that was hidden by the head, so this is a complete usable cutout. Keep the wing in the same raised orientation: long blue feather tips point up-left, broad feather fan, green rounded shoulder/root at lower-right. Root attaches to body at bottom-right; clear complete silhouette and comfortable margin. Entire wing visible, high quality clean edges, no fuzz, no outline, no shadows on background, no checkerboard. Solid flat neutral gray #CCCCCC background for precise extraction. No text. The output should resemble one extracted illustrated wing component, not a new creature or decorative feather.
