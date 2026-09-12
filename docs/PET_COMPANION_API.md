# 学习宠物 PetCompanion

`PetCompanion` 是可选的状态与互动层。它调用现有 `PipiEngine`，管理成长、场景、请求与照料流程；旧项目不导入该模块时，单击抚摸、双击取消等行为保持不变。

## 运行示例

```sh
git lfs pull
npm ci
npm run dev
```

打开 `http://127.0.0.1:8765/examples/companion/`。示例有加法学习、成长日记、喂食、香皂涂抹、休息和动作预览。示例钱包初始 12 颗籽，答对一道题 +3，喂食每餐 -3；数据只存在本机，不是账号资产。声音默认关闭，支持的浏览器可使用本机语音合成。微信接入应提供录音 URL。

新素材的制作和验收状态以 `assets/companion/` 中实际存在的清单与验证记录为准；`source/` 原始分镜不等同于透明运行图集。

## 接入

```js
import { createWebPet } from '@cloudy064/pipi-engine';
import {
  PetCompanion, createWebStore, installCompanionAnimations,
} from '@cloudy064/pipi-engine/companion';

const pet = createWebPet(canvas, { size: 58, assetBaseURL: '/pet/base' });
await pet.ready;
const manifest = await fetch('/pet/companion/manifest.json').then(r => r.json());
installCompanionAnimations(pet, manifest, { baseURL: '/pet/companion' });
const companion = new PetCompanion(pet, {
  storage: createWebStore(localStorage, 'my-pet-state-v1'),
  wallet, // 由业务提供，契约见下文
  mode: 'home', muted: true,
});
await companion.ready;
await companion.welcome(sessionId);
companion.setMode('learning');
await companion.handleEvent({
  id: serverEvent.id,
  revision: serverEvent.revision,
  type: 'knowledgeMastered',
  displayName: '凑十',
  confirmedGrowthPoints: 3,
});
```

普通脚本先加载 `dist/pipi-engine.js`，再加载 `dist/pipi-companion.js`，分别使用 `Pipi` 和 `PipiCompanion` 全局变量。可选包不包含新动作 PNG；图片单独托管并按需加载。

微信使用 `require('@cloudy064/pipi-engine/companion/wechat')`，或复制 `dist/miniprogram/companion.js` 后直接 require。传入 `createWechatStore(wx)` 与已有的微信 `PipiEngine` 即可；模块顶层不访问 DOM 或微信全局对象。

优先在页面间复用一个协调器。内置存储现在用 `save(state, {expectedRevision})` 拒绝旧版本覆盖；每个业务操作先重新读取已保存状态，再进行计算。Web 适配器通过同源 Web Locks 原子执行读取、版本比较和写入；微信适配器在同一个 wx API 对象、同一个存档 key 下共享串行写队列。微信多 JS 运行环境和跨设备仍需服务端原子存档。

Web 存档需要 HTTPS 或 localhost 下的 Web Locks；不支持时明确拒绝写入，可改用 `createMemoryStore()` 做临时体验，或提供具有原子条件写入的存储适配器。不会静默降级到可能丢失进度的 localStorage 覆盖。小院示例还持有独占的账号锁，第二个标签页会提示关闭原页面后刷新，以保护示例钱包和事件队列。

## 成长和业务事件

支持 `taskCompleted`、`knowledgeMastered`、`gameCompleted`。调用表示业务已确认事件，不是让引擎判题。没有传 `confirmedGrowthPoints` 时，知识点事件默认 +3，其他事件默认 +1；传 0 可只展示反馈。

`id` 用于近期重复去重；`revision` 现在是必填的正安全整数，是同一宠物全部学习事件流的递增序号。即使旧 ID 已超出最近 256 条记录，旧序号仍返回 `duplicate`。缺少或非法序号会拒绝操作，不保存、不奖励。三个事件类型共用同一个序号流；必须按序交付，不能按页面或类型分别编号。序号可以有间隔，但旧序号会被视为重复，SDK 不缓存乱序事件。重试必须保持原 ID、原序号与原奖励值。

生产事件序号应由服务端持久分配，客户端不能用本地 `eventRevision + 1` 为每次重试重新编号。小院示例在独占账号锁下先将编号和奖励写入本地待投递队列，再按序交付；刷新重放同一个事件，不重复发籽。这是可靠本地演示，不承担账号防作弊。

状态先保存成功，再播放反馈。保存失败会拒绝操作，既不增加内存中的成长，也不播放成功反馈。动画被拖动、换页或后台打断不撤销已保存进度。返回值 `accepted` 表示状态已保存，不表示动画已经播完。

默认身体高度：`58 + 46 × min(1, log(1 + G / 5) / log(65))`。累计 10 点约 70.1px，80 点约 89.2px，320 点达到 104px。`growthHeight(points, rules)` 可独立使用。单位是逻辑身体像素，与素材整张尺寸不同；`engine.baseSize` 保持创建时的基准。

`rules` 可覆盖 `minHeight/maxHeight/growthEase/growthCap`。饥饿、消费和长时间离线均不减少永久成长。照料时默认临时放大 2.25 倍，可通过 `careZoom` 调整；退出后恢复正常成长尺寸。

## 场景和交互

| 模式 | 行为 |
| --- | --- |
| `home` | 加权随机待机，不连续重复，默认每次动作后休息 6–12 秒 |
| `learning` | 停止闲逛和主动照料请求，允许明确的学习奖励及手动交互 |
| `care` | 停止普通拖动，由照料界面处理触摸 |
| `rest` | 有睡觉素材时进入持续睡眠，离开后重置本轮休息提醒计时 |
| `hidden` | 停止动作与排队反馈，恢复时返回之前模式 |

`setMode()` 会取消当前自动行为；后台不会补播堆积的奖励动画。Web/微信引擎可见性变化会同步到协调器。动作时钟和实际前台使用时长分开，不因播放加速提前触发休息提醒。

默认新交互：单击在抚摸、点头、眨眼中选择；双击在鸟吻、跳跃、眨眼中选择；缺失动作从候选中排除。拖动取消待触发点击。传 `interaction:'legacy'` 保留旧行为。`playAction(id, options)` 用于显式按钮；`pace({distance})` 用已有走路素材往返踱步，仅在首页模式运行。

`beginPetting('pet'|'scratch')` 进入独立的抚摸区域，`stroke({x,y})` 接收身体归一化坐标；足够距离的两次往返才回应，静止按住不触发。响应有冷却，抚摸不会同时触发拖动。`endPetting()` 退出并恢复正常尺寸。该方式让用户明确选择照料操作，避免把拖动误判成抚摸。未完成洗澡的存档只保存进度，进入抚摸不会自动播放洗澡，也不能通过 `wash/rinse` 修改洗澡进度；调用 `beginBath()` 才恢复。洗澡切后台再回来仍恢复洗澡；抚摸切后台后回到首页，不因旧洗澡存档切换照料类型。

引擎新增 `interactionMode:'events'` 可只发出 `interaction` 事件，包含 `tap/doubletap/down/dragstart/dragend`，供业务自行实现策略。`interactionLocked` 暂时禁用内置拖动。自由模式新增 `weights` 与 `avoidRepeat`，旧默认不变。

## 请求和休息

默认饱足每小时 -4、清洁每小时 -2，单次离线追赶最多 8 小时；状态下限为 0。首页至少停留 30 秒后才可请求，默认请求间隔 15 分钟，一次只保留一个请求。低于 35 时优先询问喂食/洗澡，否则轮换挠痒、抚摸和教一教。做题、照料、休息和后台不主动催促。

监听 `request` 展示确认入口；`dismissRequest()` 忽略本次；`respondToRequest()` 对需要业务界面的请求发出 `intent`（`feed/bath/learn`），不自动花钱。

前台累计达到可配置 `eyeBreakMs`（示例默认 20 分钟）后，调用 `requestEyeBreak()` 在题目边界展示提醒。该默认值是产品参数，不是医学建议。进入休息后不继续累计学习时长。`tick(ms)` 通常由引擎自动驱动，使用手工时钟时才自行调用，避免重复计时。

## 喂食与幂等钱包

```js
await companion.feed({ operationId: uniqueId }); // 默认 3 颗籽，饱足 +30
await companion.recoverCare();                  // 网络异常或重启后的未完成操作
```

钱包必须实现：

```js
async function spend({ operationId, amount, reason }) {
  // 原子扣款，重复 operationId 返回原来的同一个结果。
  // 同一个 id 不得用于不同金额或不同原因。
  return { operationId, status: 'committed', revision: receiptSequence };
  // 余额不足返回 {operationId,status:'declined',revision:currentSequence}。
}
```

`revision` 是该宠物消费流中递增的收据序号。协调器先保存 `pendingCare` 再调用钱包；超时保留原 ID，重试不生成新扣款。收据必须稳定重放。扣款已提交但响应丢失时，通过 `recoverCare()` 重取收据并应用照料效果一次。收据确认后先保存照料收益，再播放动画；动画失败不吞掉收益。

饱足达到 95 时拒绝无效喂食；做题和后台不能新发起喂食。有未决操作时必须先恢复它。余额不足返回 `insufficient-funds`，不改变饱足。不要把实际扣款放在动画结束回调中。

内置存储没有账号账本能力。服务端必须保证 ID 幂等、余额非负和收据持久化；离线消费是否允许由钱包决定。示例钱包只演示流程，不作为生产钱包实现。

## 洗澡

```js
await companion.beginBath(uniqueId);
await companion.wash({ x: 0.45, y: 0.7 }); // 相对身体矩形归一化坐标
await companion.rinse();
companion.cancelBath();
```

清洗区域是 8×12 网格中的身体区域，排除脸部及边角。重复涂抹同一网格不增加覆盖率。达到 75% 进入 `rinse` 阶段，冲洗完成清洁设为 100。退出会保存进度，下一次 `beginBath` 恢复原操作 ID；完成的 ID 不能再次发收益。

监听 `bath` 和 `change` 绘制泡泡、更新按钮；根据当前皮皮尺寸映射触摸坐标。泡泡由界面独立绘制，不污染角色原图。默认免费，可通过 `bathCost` 配置非负整数费用；收费洗澡同样走幂等钱包。

`carephase` 跟随实际播放帧发出 `{action,phase,frame,elapsed}`：吃籽为 `offer/seed-at-beak/chew/satisfied`，洗澡为 `prepare/soap/rinse`。它们是展示事件，不能用于记账；暂停时不推进，跳帧时反映当前姿态。

## 透明动作包与独立道具

`assets/companion/manifest.json` 包含 16 个新动作及 538 帧。通过 `installCompanionAnimations()` 安装后按动作加载，不改变已有基础包。睡眠、洗澡、单脚站立和扑翅使用 `staged`，可 `play(id,{sustain:true})` 后 `release()` 自然收尾。

吃籽与磨嘴采用 `companionClip`，独立道具和身体共享帧号；`pet.play('eatSeed',{effects:false})` 关闭道具且不申请其资源。示例动作预览页提供道具开关和深浅背景检查。原件、母版、接触表及哈希保存在动作包目录。

```sh
npm run export:companion-assets -- /path/to/hosted/companion
```

导出会核对图集和音频哈希，并复制运行 PNG、歌曲和清单。将输出目录作为 `baseURL`；无需托管原始生成图。

## 台词、音频与儿歌

`COMPANION_DIALOGUE` 提供中英台词，`dialogue` 选项可覆盖。`audioCatalog` 的格式是 `{ 'zh-CN': {welcome:'/audio/hello.mp3'}, en:{...} }`。没有录音时仍发出 `dialogue` 文本事件，不制造虚假的播放成功记录。

Web 可传 `voice:createBrowserVoice(window)` 使用浏览器已有声音；语音语言、可用性与效果由浏览器决定。该适配器独占本页的语音合成队列，不应同时让其他模块调用同一个队列。它不进入微信平台依赖。语音暂停、取消、超时及卸载同步清理。

```js
companion.setMuted(false);
companion.setLocale('en');
await companion.sing({
  title: '我们的数数歌', locale: 'zh-CN',
  audioURL: '/audio/counting-song.mp3', gesture: 'talk',
});
```

曲目由业务提供录音 URL，默认只在首页且非静音时播放。库不自带第三方儿歌录音。使用带独立嘴部动画的 `talk`，或确认与嘴部覆盖兼容的动作；`allowSpeech:false` 会禁止错位嘴部补丁叠加到新姿态。跳跃、点头和洗澡等反馈动作播放一次，然后再说话，不随音频无限重复。

仓库示例另提供两首原创数数歌，见 `assets/companion/audio/catalog.json`。中文约 14.6 秒，英文约 14.1 秒，使用合成歌声；文件随可选素材导出，不进入基础代码包。曲目含词句、音符时间及 SHA-256，可直接替换为业务录音。

## 保存、生命周期和验证

`storage` 实现异步 `load()` 和 `save(state, {expectedRevision})`。自定义适配器必须在同一个原子事务中比较当前 revision（无存档时为 0）与 expectedRevision，并写入 revision+1 的状态；不匹配时抛出 `StorageConflictError`，不能仅忽略第二个参数。所有写入者必须遵守这个契约。提供 `createMemoryStore`、`createWebStore`、`createWechatStore`。无效存档或真实读取错误会拒绝初始化，不静默覆盖用户进度。存档 `version:1`，升级时需要明确迁移。

发生并发冲突时，错误 `code` 为 `COMPANION_STORAGE_CONFLICT`。当前操作不会发布成功反馈。保留原事件后重试 `handleEvent(event)`；照料操作通过 `recoverCare()` 恢复已保存的 pendingCare。不要给失败的操作换 ID。冲突发生在钱包成功之后时，原 pendingCare 仍可恢复；钱包的幂等回执保证不会二次扣款。存档被删除或回滚时要求重新创建协调器，不把它静默覆盖。SDK 不会自动重试包含钱包副作用的整个操作。

### 从旧调用迁移

- 每个 `handleEvent` 调用补上稳定、按序的 `revision`；原 version:1 存档继续可读，其 eventRevision 是已有水位，不要从 1 重置编号。
- 自定义存储升级为原子条件写入；单纯 `localStorage.setItem` 的旧 save 实现不满足新契约。内置适配器已实现检查。
- 云存档应由服务端检查账号权限、原子 revision 和钱包收据；序号和本地锁本身不能替代账号后端。

`destroy()` 清理订阅、语音及自动行为，恢复引擎原交互设置；不会销毁传入的引擎。引擎销毁时协调器自动清理。已提交的在途保存/钱包操作可能仍完成，用原 ID 恢复，不用关闭页面代表撤销扣款。

```sh
npm test
npm run test:types
npm run build
npm run test:package
```

Node 专项测试覆盖成长曲线、去重/保存失败、前后台、幂等扣款恢复、涂抹与中断、手势兼容和分段动作释放。图片与实际浏览器、微信真机的验证需分别记录，不能以模拟适配器测试替代。
