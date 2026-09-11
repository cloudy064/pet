'use strict';

const DIRECTIONS = Object.freeze({ n:[0,-1], ne:[1,-1], e:[1,0], se:[1,1], s:[0,1], sw:[-1,1], w:[-1,0], nw:[-1,-1] });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => { const t = clamp(value, 0, 1); return t*t*(3-2*t); };
const copy = value => JSON.parse(JSON.stringify(value));
function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(name+' must be a positive finite number');
  return value;
}
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(name+' must be finite');
  return value;
}
function identifier(value, name = 'Identifier') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,99}$/.test(value)) throw new TypeError(name+' is invalid');
  return value;
}
function direction(dx, dy) {
  return Math.hypot(dx,dy) < 0.01 ? 's' : ['e','se','s','sw','w','nw','n','ne'][(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8];
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a,b) => { resolve=a; reject=b; });
  return { promise, resolve, reject };
}
function joinURL(base, file) {
  if (/^(https?:|data:|blob:|wxfile:)/.test(file) || file.startsWith('/')) return file;
  return (base ? base.replace(/\/+$/,'')+'/' : '')+file;
}
function freeze(value) {
  if (value && typeof value==='object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
module.exports = { DIRECTIONS, clamp, smooth, copy, freeze, positive, finite, identifier, direction, deferred, joinURL };
