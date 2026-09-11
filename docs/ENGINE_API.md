# 皮皮动画引擎 API

`@cloudy064/pipi-engine` 把皮皮的动作定义、播放计划、Canvas 绘制和平台能力分开。Web 和微信小程序共用 `PipiEngine`；每个实例有自己的播放、语音、位置、成长和解码缓存。源码在 `engine/`，构建结果在 `dist/`，类型声明随包提供。

## 创建与释放

```js
import { createWebPet } from '@cloudy064/pipi-engine';

const pet = createWebPet(canvas, {
  width: 640, height: 480, size: 112,
  position: { x: 320, y: 360 },
  dpr: window.devicePixelRatio,
  assetBaseURL: '/pet-assets'
});
await pet.ready;
await pet.play('wave');
// 页面或组件释放时调用。
pet.destroy();
```

微信使用 `createWechatPet(canvasNode, wx, options)`，也可直接使用随包提供的组件。完全自定义平台接入可用 `new PipiEngine({ adapter, ...options })`。引擎模块加载时不访问 DOM、`wx` 或 Node 系统 API。

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `width`, `height` | Canvas 尺寸 | 舞台逻辑像素尺寸 |
| `size` | 112 | 皮皮身体的基准高度，所有动作共用 |
| `scale` | 1 | 永久缩放；实际身体尺寸为 `size × scale` |
| `position` | 舞台中央偏下 | 脚底锚点，不是图片左上角 |
| `dpr` | 1 | 画布像素倍率；不改变动作或位移坐标 |
| `padding` | 8 | 全部动作最大展开边界之外的余量 |
| `speed` | 1 | 动画和自由活动时钟倍率，音频不变速 |
| `assetBaseURL` | 内置皮皮公共素材地址 | 其他 PNG 的目录，支持本地路径和 HTTPS |
| `autoTick` | true | false 时由调用方按毫秒调用 `update(delta)` |
| `autoBlink` | true | 空闲约 3.3 秒眨眼 |
| `interactive` | true | Web 自动绑定单击、拖动、双击判定 |
| `interactionAudio` | 无 | 单击抚摸的音频 URL |
| `maxMemoryBytes` | 48 MiB | 解码图集 LRU 预算，不包括 Canvas 帧缓存 |
| `preset` | true | 安装皮皮默认动作和素材；false 时须提供 `base:idle` |
| `manifest`, `actions` | 内置 | 额外图集清单和 `ActionRegistry` 实例 |

外部传入的 `AssetManager` 由该引擎接管和释放，不要把同一个管理器交给多个引擎。微信的文件缓存会自动在实例间共享；解码 Canvas 对象仍属于各自实例。

## 内置动作

| ID | 动作 | 播放行为 |
| --- | --- | --- |
| `idle` | 默认站姿 | 持续站立，调用 `release()` 或其他动作结束 |
| `blink`, `wink`, `curious` | 眨眼、单眼眨眼、歪头 | 完整播放一次 |
| `talk`, `pet`, `jump` | 说话、抚摸、开心跳跃 | 完整播放一次 |
| `wave` | 打招呼 | 抬翅 → 完整挥翅循环 → 收翅 |
| `pointLeft`, `pointRight` | 画面左、右翅指向 | 展开 → 保持 → 收回 |
| `walk`, `flight` | 八方向走路、飞行 | 按真实起终点选姿势并移动 |
| `grow` | 长大 | 平滑放大，最终尺寸保留 |

方向代码是 `n/ne/e/se/s/sw/w/nw`；Canvas 的 y 轴向下。左右指向按观看者的画面方向命名。

## 播放与调试

```js
const handle = pet.play('wave', { sustain: true });
await handle.ready;        // 素材已加载、计划已建立
pet.pause();
pet.seek(1800);             // 定位到动作时间轴的第 1800 毫秒
pet.resume();
handle.release();           // 当前自然循环结束后收翅
const result = await handle.finished;
// 也可以直接 await handle，等待的是 finished。
```

`play(id)` 默认打断当前动作并清空队列。`play(id, {queue:true})` 排队；队列轮到它时才从当时的位置建立计划。返回 `Playback`，包含 `action/status/elapsed/duration/ready/finished/plan`，提供 `cancel()` 和 `release()`。无限循环的 `duration` 为 `Infinity`，自然收尾后变为有限值。

播放结果为 `{status:'finished'|'cancelled'|'failed', action, reason?, error?}`。缺失动作、非法参数同步抛错；异步加载失败通过结果和 `error` 事件报告，不遗留悬空 Promise。`ready` 也可能返回提前取消或加载失败的结果，要检查 `status`。

`speed` 可在引擎、动作定义、单次播放上设置，三者相乘。普通片段支持 `loop:true` 或正整数循环次数；`sustain:true` 持续到释放。招手的重复部分有大小两种挥动和停顿；释放会做完当前完整循环再收翅，因此语音结束后可能还有短暂收尾。`holdMs` 按完整中段循环向上取整，至少一个循环。

`stop({clearQueue:true})` 立即取消动作和语音。`pause()/resume()` 同步控制动画和语音；`setVisible(false)` 暂停后台时间，重新可见时继续。Web 自动绑定页面可见性；微信组件自动转发生命周期。

`setPosition(x,y)`、`setScale(scale)` 和 `resize(width,height,dpr)` 会取消当前动作，避免旧计划覆盖新的位置和尺寸。`setSpeed()` 可在播放中调整。`snapshot()` 返回当前动作、帧、时间、位置、尺寸、队列和缓存统计。`seek()` 可配合 `pause()` 检查，定位值使用动作时间，不乘全局速度。`stepFrame(1/-1)` 自动暂停并寻找下一张/上一张不同的帧；持续静止动作最多搜索 10 秒，避免无限等待。

## 位移、语音和成长

```js
await pet.moveTo({ x: 460, y: 320 }, { mode: 'flight' });
await pet.play('walk', { direction: 'nw', distance: 120 });
await pet.speak('/audio/welcome.mp3', { gesture: 'wave' });
await pet.speak('/audio/word.mp3', { gesture: 'pointRight' });
await pet.celebrate({ audio: '/audio/reward.mp3', scale: 1.15 });
```

飞行包含起飞、必要转向、扑翼位移、回正和落地；斜向使用对应图集。终点按舞台和完整翼展约束，可用 `bounds()` / `constrain(point)` 查询；没有可移动空间时返回失败结果。飞行高度独立于脚底锚点。其他动作不改变位置；跳跃的局部腾空已经包含在 PNG 中。

`speak()` 等待音频和动作收尾完成。嘴部使用独立局部帧，不依赖整个身体反复播放；可与招手、指向结合。`timeout` 默认 30 秒，不包含暂停或后台时间。音频加载、权限或播放失败会报告错误并结束持续动作。新的动作、拖动或销毁会取消旧语音。

已有业务自己管理音频时，可以在开始/结束时调用 `setSpeaking(true/false)`，同时自行维持指向动作。`celebrate()` 顺序是跳跃一次 → 说话（如果提供音频）→ 长大；被打断后不会迟到地再次长大。`growTo(scale)` 单独成长；最终 `scale` 保留。业务存档、星星到尺寸的换算由项目管理。

`startFree({actions,minDelay,maxDelay})` 在每次动作完成后休息再随机选取动作。默认 3–6 秒；走路和飞行选择舞台内可达目标，表情留在原地。`stopFree()` 停止后续随机选择；`stopFree({cancel:true})` 同时停止当前动作。自由列表不要放永不结束的自定义动作。

单击延迟 350ms 触发抚摸；双击取消这次触发。拖动超过 8px 后保持静态，始终约束到舞台内；点击空白区域不抓取皮皮。手工接入触摸时使用 `pointerDown/Move/Up({id,x,y})` 和 `pointerCancel()`，坐标必须相对 Canvas。

## 动作库与扩展

```js
pet.actions.register({
  id: 'quickBlink', label: '轻快眨眼', type: 'clip',
  asset: 'base:blink', speed: 1.3
});
pet.actions.update('quickBlink', { speed: 1.6 });
pet.actions.register({
  id: 'happyGreeting', type: 'sequence',
  steps: [{action:'wave'}, {action:'quickBlink', repeat:2}, {action:'jump'}]
});
await pet.play('happyGreeting');
```

`ActionRegistry` 提供 `register/update/remove/get/has/list/export/import`。定义保存后不可变，修改用 `update`。重复 ID、无效帧/时长、不存在的动作引用和循环引用会被拒绝；导入失败不改变原库。仍被组合动作引用的动作不能删除。改动在下次播放生效，正在播放的定义和图集快照保持稳定。组合步骤支持独立 `options` 和 `repeat`，不允许无限循环子动作。

普通片段可设置 `frames:[0,1,2,1,0]` 和同长度 `durations:[80,60,120,60,80]`。省略时复用图集顺序与时长。工作台可以复制动作、编辑这些字段，或完整导入导出项目。

```js
import { AnimationPlan } from '@cloudy064/pipi-engine';
class TinyHop extends AnimationPlan {
  constructor() { super(); this.duration=500; this.assetIds=['base:idle']; }
  sample(ms) {
    const t=Math.min(1,Math.max(0,ms/this.duration));
    return {layers:[{asset:'base:idle',frame:0}], altitude:6*Math.sin(Math.PI*t)};
  }
}
pet.registerType('tinyHop', {
  validate(action) { if (!action.id) throw new Error('缺少动作 ID'); },
  create(action, options, context) { return new TinyHop(); }
});
pet.actions.register({id:'tinyHop',type:'tinyHop',label:'轻轻跳'});
```

自定义计划继承 `AnimationPlan`，声明 `duration`、`assetIds` 和纯函数 `sample(elapsed)`；可返回 `layers`、`altitude`、`x/y`、`scale`、`pulse`。实现持续动作时同时实现 `release(elapsed)`，修改 `duration` 使其自然结束。`context` 提供图集、动作库、起始位置/尺寸和终点约束。`Timeline`、`SustainPlan`、`CombinedPlan` 可直接复用。扩展的校验器负责自定义字段和输出合法性。

`pet.use({install(engine){ ...; return cleanup; }})` 安装插件；销毁时逆序清理。JSON 只保存数据，代码扩展应先在目标实例注册，再导入使用该类型的项目。

## 图集与更新

`AssetManager` 使用下面的明确格式，不依赖旧页面的全局变量：

```js
pet.assets.define('custom:blink', {
  pages:[{file:'/images/blink.png',width:720,height:240}],
  tiles:[[0,0,0,240,240],[0,240,0,240,240],[0,480,0,240,240]],
  frameMap:[0,1,2,1,0], durations:[120,60,100,60,120],
  crop:{x:0,y:0,w:240,h:240},anchor:{x:120,y:240},subjectHeight:240,
  restFrames:[0,4]
});
```

`tiles` 中每项为 `[页序号,x,y,宽,高]`；所有帧映射到相同虚拟 `crop`，以 `anchor` 对齐脚底。不同动作可以有不同宽度。`restFrames` 表示该帧应使用公共站姿；仅在它确实与默认站姿对应时设置。`patch:true` 是皮皮局部覆盖图，先绘制站姿再替换区域，不适合任意完整角色图。内置鸟喙和睁眼区域专门对应皮皮的虚拟坐标。

清单为 `{version:1,assets:{id:definition}}`。PNG 推荐内容哈希文件名，并提供 `md5` 与 `bytes`。`await pet.preload(['wave','walk','flight'])` 预加载；方向动作会收集全部方向。它只是预热缓存：超过预算的非活动素材仍会回收，之后使用可能重新解码。

`await pet.refreshAssets(baseURL)` 检查服务器 `manifest.json` 并验证后切换项目；失败保留可用项目。内置站姿、招手、右翅和嘴部局部图随代码版本更新，刷新远程清单时保留它们，避免把完整角色图误作局部覆盖。直接操作 `assets.refresh/import` 属于低层 API；需要同时修改动作和素材时，使用 `importProject()` 做跨库校验。

Web 图片使用浏览器 HTTP 缓存。微信按 MD5 持久保存 PNG，并在重建实例后复用；清单每 10 分钟用 ETag/Last-Modified 检查，断网可继续用上次完整快照。后台检查完成后的下一次刷新使用新清单。支持文件校验、损坏重下、并发下载复用、48 MiB 文件 LRU、空间不足时临时播放。

解码缓存按 URL、MD5 和尺寸复用同一 PNG；活动动作的图集不会被回收，因此活动图集总量可以超过软预算。绘制另有 8 MiB 帧隔离缓存，防止缩放采样串到相邻格；`snapshot().cache.tileBytes` 单独报告。两者都是像素字节估算，不是进程内存实测。

`clearCache()` 清除未使用的解码图集、帧缓存及微信远程文件缓存；当前活动动作仍能完成。微信随包的四张基础图保留在独立目录，下次可离线启动；Web 的 HTTP 缓存由浏览器控制。`destroy()` 释放动画、声音、监听、已解码图片和帧画布，保留微信磁盘资源。

## 项目与事件

`exportProject()` 返回 `{version,actions,assets,settings}`。`importProject(json,{baseURL})` 先完整校验和加载新站姿，成功后原子替换；失败不破坏当前项目。导出图集路径已经包含原 `baseURL`，回导时默认不再次添加前缀；迁移到其他目录时可先调整导出的 `pages[].file`。不要把动态音频 URL、用户账号或密钥放进动作 JSON。

`on(event,handler)` 返回取消订阅函数；支持 `once/off`。事件包括 `ready/start/finish/cancel/error/frame/move/scale/speed/pause/resume/seek/librarychange/speechstart/speechend/freemode/destroy`。`frame` 提供快照；`error` 提供 `{error,phase,action?}`。同步事件回调异常会转为 `error`，不破坏播放状态；异步业务回调自己的 Promise 由调用方处理。
