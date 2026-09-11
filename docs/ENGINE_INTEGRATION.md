# 引入皮皮引擎

## 仓库运行和工作台

```sh
git lfs install
git clone https://github.com/cloudy064/pet.git
cd pet
git lfs pull
npm ci
npm run dev
```

打开 `http://127.0.0.1:8765/皮皮_引擎工作台.html`。`npm ci` 的 prepare 阶段生成四种发布入口；也可手工运行 `npm run build`。新工作台使用独立引擎；原有调试页面保留，可继续比较已确认的动作。

工作台左侧管理动作，中间播放和定位，右侧修改名称、速度、中段停留及完整 JSON。改动保存在当前浏览器的本地动作库；跨设备使用“导出项目/导入项目”。删除仍被组合引用的动作会被拒绝。导入是事务操作，错误数据或站姿加载失败不会清掉现有项目。

## 生成和安装独立包

```sh
npm run build
npm run pack:engine
# 在另一个 Web 或小程序项目目录：
npm install /path/to/cloudy064-pipi-engine-0.1.0.tgz
```

当前提供仓库和本地发布包，尚未发布到 npm 公共注册表。不要直接运行 `npm install @cloudy064/pipi-engine` 假定它已经公开发布。

包内无运行时 npm 依赖，包含 CommonJS、ES module、浏览器全局脚本、微信组件及类型声明。四张启动 PNG 嵌入模块，默认站姿、招手、右翅指向和鸟喙无需首次网络下载。完整动作图集单独部署，不把约 40 MiB 的整套素材塞入小程序主包。

| 使用方式 | 入口 |
| --- | --- |
| Web / 打包工具 | `import {createWebPet} from '@cloudy064/pipi-engine'` |
| CommonJS | `require('@cloudy064/pipi-engine')` |
| 微信脚本 | `require('@cloudy064/pipi-engine/wechat')`（Node 包入口） |
| 不使用 npm 的 Web 页面 | `<script src="pipi-engine.js"></script>`，使用 `Pipi.createWebPet()` |
| 不使用 npm 的小程序 | 复制整个 `dist/miniprogram/`，组件和脚本都已构建 |

## Web 最小接入

```html
<canvas id="pipi" style="width:640px;height:480px"></canvas>
<script src="./pipi-engine.js"></script>
<script>
const pet = Pipi.createWebPet(document.querySelector('#pipi'), {
  width:640, height:480, size:112, dpr:devicePixelRatio,
  assetBaseURL:'/assets/pet'
});
pet.ready.then(() => pet.play('wave'));
window.addEventListener('pagehide', event => {
  if (!event.persisted) pet.destroy();
});
</script>
```

完整 ES module 示例在 `examples/web/`。Canvas 的 CSS 尺寸、逻辑尺寸应一致，布局变化时调用 `resize()`；不要通过 CSS 单独放大某个动作。语音播放建议由点击触发；浏览器阻止自动播放时，引擎会收尾并发出 `error`。

## 微信小程序：复制构建目录

在仓库执行 `npm run example:wechat`，再用微信开发者工具导入 `examples/wechat/`，可以看到完整页面和组件。示例默认游客 AppID，正式预览/真机请在自己的项目使用自己的 AppID。示例不包含密钥，也不需要新建后台。

接入已有项目时，复制 `dist/miniprogram/` 整个目录到小程序根下，例如 `lib/pipi/`。它里面包含 `index.js`、类型声明及 `component/`，不能只复制组件单个文件。

页面 JSON：

```json
{"usingComponents":{"pipi-pet":"/lib/pipi/component/index"}}
```

页面 WXML：

```xml
<pipi-pet id="pet" width="360" height="420" size="96"
  bind:ready="onPetReady" bind:error="onPetError" />
```

页面 JS：

```js
Page({
  onPetReady() {
    this.pet = this.selectComponent('#pet').getEngine();
    this.pet.play('wave');
  },
  onPetError(event) { console.error(event.detail.message); },
  pointAtWord() {
    this.pet.speak('https://your-domain/audio/word.mp3', {gesture:'pointRight'});
  }
});
```

组件自动处理 Canvas 查询、DPR、触摸、页面隐藏恢复和卸载销毁；`ready` 表示默认 PNG 已可绘制。`getEngine()` 在此之前可能返回 `null`。组件的 `width/height/size` 都是逻辑 px，尺寸应覆盖移动范围和最大翼展。它不会自动抢占全屏，也不会替业务决定页面层级；作为浮动角色使用时，在业务容器上设置定位和 z-index。

使用 npm 时，将 tarball 安装到小程序目录，执行开发者工具“工具 → 构建 npm”，再引用 `@cloudy064/pipi-engine/component/index`。包的 `miniprogram` 字段指向构建好的微信目录。若构建器或项目结构不同，复制整个构建目录的方式最直接。

不使用组件时，可用 `require('/lib/pipi/index')` 得到 `createWechatPet`。自己查询 `<canvas type="2d">` 节点并传入 `wx`；转发 Canvas 触摸的 `x/y`（不是 `clientX/pageX`），以及 `setVisible` 和 `destroy`。基础库至少 2.16.1，使用新版 2D 离屏 Canvas；开发示例采用 3.17.2。API 形状已与[微信官方类型声明](https://github.com/wechat-miniprogram/api-typings)核对，Canvas 约束见[官方离屏 Canvas 文档](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createOffscreenCanvas.html)。

远程素材及声音域名需要加入小程序相应的 request/downloadFile 合法域名。默认素材和语音沿用现有 `pipi.aiede.cn/math/` 公共资源；可替换为自己的 HTTPS 目录，不要求搭建新的业务后端。

## 自行托管资源

`assets/engine/` 是已发布紧凑图集的独立快照，包含 33 张 PNG 和清单；与已有识字、数学项目素材字节一致，MD5 可复核。原来的 `assets/runtime/` 是旧网页长图格式，不要直接把它的清单传给新引擎。

```sh
npm run export:assets -- /path/to/static/pet
```

导出前逐个校验 MD5 和大小；如果拿到的是 LFS 指针，命令会失败并提示 `git lfs pull`。导出的目录可放在任何静态 HTTP 服务/CDN 上。设置 `assetBaseURL` 指向目录即可；微信 PNG 使用 MD5 缓存，服务器建议返回 ETag/Last-Modified。Web 跨域绘图需要图片服务器允许 CORS，建议使用内容哈希文件名。语音由业务传入 URL，不强制绑定默认声音。

清单更新时可调用 `await pet.refreshAssets()`。代码包内启动图跟随引擎版本更新，远程清单只更新其他动作；不同页面不必重复下载相同 MD5 的 PNG。离线支持是微信已经缓存过的素材复用；首次未下载过的远程动作在离线时会返回加载失败，站姿和招手仍可用。

## 从旧控制器迁移

| 旧逻辑 | 新接口 |
| --- | --- |
| 自己推进序列帧与循环区间 | `play()`、`release()`、`pause()` |
| 分别维护走路和飞行的方向 | `moveTo({x,y},{mode})` |
| 单翅动作中循环身体来表示说话 | `speak(url,{gesture:'pointLeft'/'pointRight'})` |
| 欢迎语期间机械重播中间帧 | `speak(url,{gesture:'wave'})` |
| 页面各自放大角色 CSS | 统一 `size` 和持久 `scale` |
| 两处回调都播放奖励跳跃 | 单一入口 `celebrate({audio,scale})` |
| 页面退出清空所有 PNG | `destroy()`，保留微信磁盘缓存 |

字的位置、左右指字停靠策略、奖励数值、成长存档和登录等仍属于业务。引擎提供完整动作与位移接口；迁移时替换原来的播放控制器，避免新旧两个定时器同时绘制同一 Canvas。此次提供独立包和示例，没有直接替换识字或数学生产项目。

## 验证

```sh
npm test
npm run test:types
npm run build
npm run test:browser
npm run test:wechat
npm run test:package
```

浏览器检查需要 Python 及 `playwright`（`python -m pip install playwright`）；Windows 使用已安装 Edge，其他系统运行 `python -m playwright install chromium`。微信编译检查需要本机开发者工具，可用 `WECHAT_DEVTOOLS`，或 `WCC_BIN/WCSC_BIN` 指定编译器。

测试覆盖播放与取消、动作库事务、自定义类型、八方向移动、语音成长顺序、触摸、缓存重启/校验/配额、真实 PNG 渲染、工作台操作、类型声明、原生 WXML/WXSS 编译和独立消费项目安装。结果在忽略目录 `test-results/engine/`；包测试会保留一个系统临时消费项目供排查。浏览器 Canvas 和微信适配器契约测试不等于 iOS/Android 真机视觉结果，真机音频权限和平台绘制差异仍应在接入项目里检查。
