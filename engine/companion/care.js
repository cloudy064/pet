'use strict';
const { copy } = require('../core/utils');
const { validateCare, remember, timestamp, BATH_CELLS, washCell } = require('./rules');
const identifier = (id) => {
  if (typeof id !== 'string' || !id.trim() || id.length > 160)
    throw new TypeError('A unique event/operation id is required');
  return id;
};

class CompanionCare {
  constructor(companion) {
    this.companion = companion;
  }
  feed({ operationId, count = this.companion.config.feedCost } = {}) {
    const c = this.companion;
    return c.serialize(async () => {
      identifier(operationId);
      if (count !== c.config.feedCost) throw new RangeError('One meal costs ' + c.config.feedCost + ' seeds');
      if (c.state.recentCare.includes(operationId)) return { status: 'duplicate' };
      if (c.state.pendingCare) {
        if (c.state.pendingCare.id !== operationId)
          throw new Error('Recover the pending care operation first');
        return c.finishCare(c.state.pendingCare);
      }
      if (c.currentState().satiation >= 95) return { status: 'full' };
      if (c.mode === 'learning' || c.mode === 'hidden') return { status: 'cancelled', reason: 'mode' };
      return c.beginCare({ id: operationId, kind: 'feed', cost: count, gain: c.config.feedGain });
    });
  }

  async beginCare(operation) {
    const c = this.companion;
    validateCare(operation);
    if (operation.cost && (!c.options.wallet || typeof c.options.wallet.spend !== 'function'))
      throw new Error('A wallet with idempotent spend is required');
    const next = c.currentState();
    next.pendingCare = copy(operation);
    await c.commit(next);
    return c.finishCare(operation);
  }

  async finishCare(operation) {
    const c = this.companion;
    // Wallet must replay the SAME receipt for the same operation ID, including after a network timeout.
    // Its monotonically increasing revision also prevents replay after the bounded local history expires.
    const receipt = operation.cost
      ? await c.options.wallet.spend({
          operationId: operation.id,
          amount: operation.cost,
          reason: operation.kind,
        })
      : { operationId: operation.id, status: 'committed', revision: c.state.walletRevision };
    if (
      !receipt ||
      receipt.operationId !== operation.id ||
      !['committed', 'declined'].includes(receipt.status) ||
      !Number.isSafeInteger(receipt.revision) ||
      receipt.revision < 0 ||
      (operation.cost && receipt.status === 'committed' && receipt.revision < 1)
    )
      throw new Error('Invalid wallet receipt; operation remains pending for recovery');
    const next = c.currentState();
    next.pendingCare = null;
    const alreadyApplied =
      next.recentCare.includes(operation.id) ||
      (operation.cost > 0 && receipt.status === 'committed' && receipt.revision <= next.walletRevision);
    if (receipt.status === 'committed' && !alreadyApplied) {
      if (operation.kind === 'feed') next.satiation = Math.min(100, next.satiation + operation.gain);
      else {
        next.cleanliness = 100;
        next.bath = null;
      }
      next.walletRevision = Math.max(next.walletRevision, receipt.revision);
      next.recentCare = remember(next.recentCare, operation.id, c.config.historyLimit);
    }
    await c.commit(next);
    if (receipt.status === 'declined') return { status: 'insufficient-funds' };
    if (alreadyApplied) return { status: 'duplicate' };
    c.request = null;
    if (!c.destroyed && !['learning', 'hidden', 'rest'].includes(c.mode)) {
      if (operation.kind === 'bath' && c.mode === 'care' && c.engine.current?.action === 'bath') {
        c.closeBathPose().catch((error) => c.emit('error', { error, phase: 'bath-close' }));
      } else {
        if (c.mode === 'care') c.setMode('home');
        c.enqueueFeedback(operation.kind);
      }
    }
    c.emit('care', { type: operation.kind, operationId: operation.id, receipt: copy(receipt) });
    return { status: 'accepted', receipt, state: c.exportState() };
  }

  recoverCare() {
    const c = this.companion;
    return c.serialize(() =>
      c.state.pendingCare ? c.finishCare(c.state.pendingCare) : { status: 'nothing-pending' }
    );
  }

  beginBath(operationId) {
    const c = this.companion;
    return c.serialize(async () => {
      identifier(operationId);
      if (c.mode === 'learning' || c.mode === 'hidden') return { status: 'cancelled', reason: 'mode' };
      if (c.state.pendingCare) throw new Error('Recover the pending care operation first');
      if (c.state.recentCare.includes(operationId)) return { status: 'duplicate' };
      const next = c.currentState();
      if (!next.bath) next.bath = { id: operationId, phase: 'soap', cells: [] };
      const generation = c.generation;
      await c.commit(next);
      if (c.destroyed || generation !== c.generation)
        return { status: 'accepted', reason: 'saved-for-later', bath: c.snapshot().bath };
      if (c.mode === 'care') c.interrupt();
      c.careKind = 'bath';
      c.setMode('care');
      c.petting = null;
      if (c.engine.current?.action !== 'bath') c.startBathPose();
      c.emit('bath', c.snapshot().bath);
      c.emit('change', c.snapshot());
      return { status: 'accepted', bath: c.snapshot().bath };
    });
  }

  bathCoverage() {
    const c = this.companion;
    return c.state && c.state.bath ? c.state.bath.cells.length / BATH_CELLS.length : 0;
  }

  startBathPose() {
    const c = this.companion;
    if (c.engine.actions.has('bath')) c.engine.play('bath', { sustain: true });
  }

  async closeBathPose() {
    const c = this.companion;
    const playback = c.engine.current,
      generation = c.generation;
    c.bathClosing = true;
    c.emit('change', c.snapshot());
    playback.release();
    await playback.finished;
    if (c.destroyed || generation !== c.generation || c.mode !== 'care') return;
    c.setMode('home');
    c.say('bath');
  }

  wash({ x, y }) {
    const c = this.companion;
    return c.serialize(async () => {
      if (c.mode !== 'care' || c.careKind !== 'bath' || !c.state.bath || c.state.bath.phase !== 'soap')
        return { status: 'ignored' };
      const cell = washCell(x, y);
      if (cell === null || c.state.bath.cells.includes(cell))
        return { status: 'unchanged', coverage: c.bathCoverage() };
      const next = c.currentState();
      next.bath.cells.push(cell);
      if (next.bath.cells.length / BATH_CELLS.length >= 0.75) next.bath.phase = 'rinse';
      await c.commit(next);
      c.emit('bath', c.snapshot().bath);
      return { status: 'accepted', coverage: c.bathCoverage(), phase: c.state.bath.phase };
    });
  }

  rinse() {
    const c = this.companion;
    return c.serialize(async () => {
      if (c.mode !== 'care' || c.careKind !== 'bath' || !c.state.bath || c.state.bath.phase !== 'rinse')
        return { status: 'not-ready' };
      if (c.state.pendingCare) return c.finishCare(c.state.pendingCare);
      return c.beginCare({ id: c.state.bath.id, kind: 'bath', cost: c.config.bathCost, gain: 100 });
    });
  }

  cancelBath() {
    const c = this.companion;
    if (c.mode === 'care') c.setMode('home');
    return c;
  }

  beginPetting(kind = 'pet') {
    const c = this.companion;
    return c.serialize(async () => {
      if (!['pet', 'scratch'].includes(kind)) throw new TypeError('Choose pet or scratch');
      if (['learning', 'hidden'].includes(c.mode)) return { status: 'cancelled', reason: 'mode' };
      if (c.state.pendingCare) throw new Error('Recover the pending care operation first');
      if (c.mode === 'care') c.interrupt();
      c.careKind = kind;
      c.setMode('care');
      c.petting = { last: null, direction: 0, turns: 0, distance: 0, respondedAt: -Infinity };
      c.emit('change', c.snapshot());
      return { status: 'accepted' };
    });
  }

  stroke({ x, y }) {
    const c = this.companion;
    c.ensureAlive();
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Stroke coordinates must be finite');
    const p = c.petting;
    if (c.mode !== 'care' || !p) return { status: 'ignored' };
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      p.last = null;
      p.direction = 0;
      p.turns = 0;
      p.distance = 0;
      return { status: 'outside' };
    }
    if (!p.last) {
      p.last = { x, y };
      return { status: 'tracking' };
    }
    const dx = x - p.last.x,
      dy = y - p.last.y,
      distance = Math.hypot(dx, dy);
    if (distance < 0.04) return { status: 'tracking' };
    const direction = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : Math.sign(dy);
    if (p.direction && direction !== p.direction) p.turns++;
    p.direction = direction;
    p.distance += Math.min(distance, 0.4);
    p.last = { x, y };
    const now = timestamp(c.clock());
    if (p.turns >= 2 && p.distance >= 0.6 && now - p.respondedAt >= 1200 && !c.feedbackBusy) {
      p.turns = 0;
      p.distance = 0;
      p.respondedAt = now;
      const action = c.engine.actions.has(c.careKind) ? c.careKind : 'pet';
      c.say(c.careKind);
      c.playAction(action).catch((error) => c.emit('error', { error, phase: 'petting' }));
      c.emit('stroke', { kind: c.careKind });
      return { status: 'responded' };
    }
    return { status: 'tracking' };
  }

  endPetting() {
    const c = this.companion;
    if (c.petting) c.setMode('home');
    return c;
  }
}
module.exports = { CompanionCare };
