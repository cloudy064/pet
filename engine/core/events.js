'use strict';

class EventEmitter {
  constructor() { this.listeners = new Map(); }
  on(type, listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener must be a function');
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.off(type, listener);
  }
  once(type, listener) {
    const remove = this.on(type, value => { remove(); listener(value); });
    return remove;
  }
  off(type, listener) {
    const group = this.listeners.get(type);
    if (group) { group.delete(listener); if (!group.size) this.listeners.delete(type); }
  }
  emit(type, detail) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener(detail);
  }
  removeAllListeners() { this.listeners.clear(); }
}
module.exports = { EventEmitter };
