'use strict';
const { PipiEngine } = require('./core/engine');
const { WechatAdapter } = require('./adapters/wechat');

// A component definition factory keeps wx and Component out of the core module.
function createWechatComponent(wxApi, defaults = {}) {
  return {
    options: { styleIsolation: 'isolated' },
    properties: {
      width: { type: Number, value: 320 },
      height: { type: Number, value: 380 },
      size: { type: Number, value: 96 },
      assetBaseURL: { type: String, value: '' },
    },
    lifetimes: {
      attached() {
        this._petAlive = true;
        this._petVisible = true;
      },
      ready() {
        this.createSelectorQuery()
          .select('#pipi-canvas')
          .fields({ node: true, size: true })
          .exec((rows) => {
            if (!this._petAlive) return;
            const row = rows && rows[0];
            if (!row || !row.node) {
              this.triggerEvent('error', { message: 'Canvas 2D node not found' });
              return;
            }
            const info = wxApi.getWindowInfo ? wxApi.getWindowInfo() : wxApi.getSystemInfoSync();
            this.pet = new PipiEngine({
              ...defaults,
              adapter: new WechatAdapter(row.node, wxApi),
              width: row.width || this.properties.width,
              height: row.height || this.properties.height,
              size: this.properties.size,
              dpr: info.pixelRatio || 1,
              ...(this.properties.assetBaseURL ? { assetBaseURL: this.properties.assetBaseURL } : {}),
            });
            this.pet.setVisible(this._petVisible);
            this.pet.on('error', (e) =>
              this.triggerEvent('error', { message: e.error.message, phase: e.phase })
            );
            this.pet.on('finish', (e) => this.triggerEvent('finish', { action: e.action, status: e.status }));
            this.pet.ready
              .then(() => {
                if (this._petAlive) this.triggerEvent('ready', {});
              })
              .catch(() => {});
          });
      },
      detached() {
        this._petAlive = false;
        if (this.pet) {
          this.pet.destroy();
          this.pet = null;
        }
      },
    },
    observers: {
      'width,height'(width, height) {
        if (this.pet && !this.pet.destroyed) this.pet.resize(width, height);
      },
      size(size) {
        if (this.pet && !this.pet.destroyed) this.pet.setScale(size / this.pet.baseSize);
      },
    },
    pageLifetimes: {
      show() {
        this._petVisible = true;
        if (this.pet) this.pet.setVisible(true);
      },
      hide() {
        this._petVisible = false;
        if (this.pet) this.pet.setVisible(false);
      },
      resize() {
        if (this.pet) this.pet.pointerCancel();
      },
    },
    methods: {
      getEngine() {
        return this.pet || null;
      },
      play(action, options) {
        if (!this.pet) throw new Error('Wait for the component ready event');
        return this.pet.play(action, options);
      },
      touchStart(event) {
        this.forwardTouch('pointerDown', event);
      },
      touchMove(event) {
        this.forwardTouch('pointerMove', event);
      },
      touchEnd(event) {
        this.forwardTouch('pointerUp', event);
      },
      touchCancel() {
        if (this.pet) this.pet.pointerCancel();
      },
      forwardTouch(method, event) {
        if (!this.pet) return;
        const points =
          event.changedTouches && event.changedTouches.length ? event.changedTouches : event.touches;
        if (!points || !points.length) return;
        const touch = points[0];
        // Canvas touch x/y are relative to this canvas, never pageX/clientX.
        if (Number.isFinite(touch.x) && Number.isFinite(touch.y))
          this.pet[method]({ id: touch.identifier, x: touch.x, y: touch.y });
      },
    },
  };
}
module.exports = { createWechatComponent };
