const { DEFAULT_AUDIO_BASE } = require('../../lib/pipi/index');
Page({
  data: { width: 320, status: '皮皮正在准备…' },
  onLoad() {
    const info = wx.getWindowInfo();
    this.setData({ width: info.windowWidth - 24 });
  },
  onResize(event) {
    this.setData({ width: event.size.windowWidth - 24 });
  },
  onPetReady() {
    this.pet = this.selectComponent('#pet').getEngine();
    this.setData({ status: '皮皮准备好了' });
  },
  onPetError(event) {
    this.setData({ status: event.detail.message });
  },
  run(fn) {
    if (!this.pet) return;
    this.pet.stopFree();
    try {
      const task = fn(this.pet);
      if (task && task.catch) task.catch((error) => this.setData({ status: error.message }));
    } catch (error) {
      this.setData({ status: error.message });
    }
  },
  target() {
    const b = this.pet.bounds({ lift: this.pet.size * 0.36 });
    return {
      x: this.pet.position.x > this.pet.width / 2 ? b.left + 5 : b.right - 5,
      y: (b.top + b.bottom) / 2,
    };
  },
  wave() {
    this.run((pet) => pet.play('wave'));
  },
  walk() {
    this.run((pet) => pet.moveTo(this.target()));
  },
  fly() {
    this.run((pet) => pet.moveTo(this.target(), { mode: 'flight' }));
  },
  speak() {
    this.run((pet) => pet.speak(DEFAULT_AUDIO_BASE + '/pet-welcome.mp3', { gesture: 'pointRight' }));
  },
  grow() {
    this.run((pet) => pet.celebrate({ scale: pet.scale * 1.1 }));
  },
  free() {
    this.run((pet) => pet.startFree());
  },
  stop() {
    this.run((pet) => pet.stop());
  },
});
