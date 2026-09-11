import { createWebPet, DEFAULT_AUDIO_BASE } from '../../dist/index.mjs';
const canvas = document.querySelector('canvas'),
  status = document.querySelector('#status');
const pet = createWebPet(canvas, {
  width: canvas.clientWidth,
  height: 460,
  size: 112,
  dpr: devicePixelRatio,
  assetBaseURL: '../../assets/engine',
});
window.examplePet = pet;
pet.on('error', ({ error }) => (status.textContent = error.message));
pet.on('start', ({ action }) => (status.textContent = '正在播放：' + action));
pet.on('finish', () => (status.textContent = '准备好了'));
await pet.ready;
status.textContent = '皮皮准备好了';
const run = (fn) => () => {
  pet.stopFree();
  try {
    const task = fn();
    if (task && task.catch) task.catch((error) => (status.textContent = error.message));
  } catch (error) {
    status.textContent = error.message;
  }
};
const target = () => {
  const b = pet.bounds({ lift: pet.size * 0.36 });
  return { x: pet.position.x > pet.width / 2 ? b.left + 10 : b.right - 10, y: (b.top + b.bottom) / 2 };
};
document.querySelector('#wave').onclick = run(() => pet.play('wave'));
document.querySelector('#point').onclick = run(() =>
  pet.speak(DEFAULT_AUDIO_BASE + '/pet-welcome.mp3', { gesture: 'pointRight' })
);
document.querySelector('#walk').onclick = run(() => pet.moveTo(target()));
document.querySelector('#fly').onclick = run(() => pet.moveTo(target(), { mode: 'flight' }));
document.querySelector('#reward').onclick = run(() => pet.celebrate({ scale: pet.scale * 1.1 }));
document.querySelector('#free').onclick = run(() => pet.startFree());
document.querySelector('#stop').onclick = run(() => pet.stop());
const observer = new ResizeObserver(() => {
  if (canvas.clientWidth !== pet.width) pet.resize(canvas.clientWidth, 460);
});
observer.observe(canvas);
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  observer.disconnect();
  pet.destroy();
});
