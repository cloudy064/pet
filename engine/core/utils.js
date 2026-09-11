'use strict';

const DIRECTIONS = Object.freeze({
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
  nw: [-1, -1],
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const copy = (value) => JSON.parse(JSON.stringify(value));
function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(name + ' must be a positive finite number');
  return value;
}
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite');
  return value;
}
function identifier(value, name = 'Identifier') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,99}$/.test(value))
    throw new TypeError(name + ' is invalid');
  return value;
}
function validatePlaybackOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new TypeError('Playback options must be an object');
  for (const field of ['speed', 'stride', 'distance', 'duration', 'scale'])
    if (options[field] !== undefined) positive(options[field], field);
  for (const field of ['holdMs', 'lift'])
    if (options[field] !== undefined && (!Number.isFinite(options[field]) || options[field] < 0))
      throw new TypeError(field + ' must be non-negative');
  for (const field of ['queue', 'sustain'])
    if (options[field] !== undefined && typeof options[field] !== 'boolean')
      throw new TypeError(field + ' must be boolean');
  if (
    options.loop !== undefined &&
    typeof options.loop !== 'boolean' &&
    (!Number.isInteger(options.loop) || options.loop < 1)
  )
    throw new TypeError('Loop must be boolean or a positive integer');
  if (options.direction !== undefined && !Object.prototype.hasOwnProperty.call(DIRECTIONS, options.direction))
    throw new TypeError('Expected one of eight direction codes');
  if (options.to !== undefined) {
    if (!options.to) throw new TypeError('Destination must be a point');
    finite(options.to.x, 'Destination x');
    finite(options.to.y, 'Destination y');
  }
}
function direction(dx, dy) {
  return Math.hypot(dx, dy) < 0.01
    ? 's'
    : ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function joinURL(base, file) {
  if (/^(https?:|data:|blob:|wxfile:)/.test(file) || file.startsWith('/')) return file;
  return (base ? base.replace(/\/+$/, '') + '/' : '') + file;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
module.exports = {
  DIRECTIONS,
  clamp,
  smooth,
  copy,
  freeze,
  positive,
  finite,
  identifier,
  direction,
  deferred,
  joinURL,
  validatePlaybackOptions,
};
