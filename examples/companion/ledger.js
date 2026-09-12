'use strict';
// This local demo ledger is used only while app.js owns the exclusive account Web Lock.
// It is not an account server. Keep stable event/receipt identities across reloads.
const PipiDemoLedger = {
  create(storage, key = 'pipi-example-wallet-v1') {
    let closed = false;
    let state = JSON.parse(storage.getItem(key) || 'null') || {
      balance: 12,
      revision: 0,
      eventRevision: 0,
      receipts: {},
      events: {},
    };
    const save = (next) => {
      if (closed) throw Error('Demo account is closed');
      storage.setItem(key, JSON.stringify(next));
      state = next;
    };
    return {
      close() {
        closed = true;
      },
      snapshot: () => JSON.parse(JSON.stringify(state)),
      migrate(floor) {
        let revision = Math.max(
          floor,
          state.eventRevision || 0,
          ...Object.values(state.events).map((e) => e?.revision || 0)
        );
        const events = Object.fromEntries(
          Object.entries(state.events).map(([id, e]) => [
            id,
            e && typeof e === 'object' && !e.delivered && !e.revision
              ? { ...e, revision: ++revision, type: 'taskCompleted' }
              : e,
          ])
        );
        save({ ...state, eventRevision: revision, events });
      },
      enqueue(id, type, growth, seeds) {
        if (state.events[id]) return;
        const revision = state.eventRevision + 1;
        save({
          ...state,
          eventRevision: revision,
          balance: state.balance + seeds,
          events: { ...state.events, [id]: { type, growth, revision, delivered: false } },
        });
      },
      pending: () =>
        Object.entries(state.events)
          .filter(([, e]) => e && typeof e === 'object' && !e.delivered)
          .map(([id, e]) => ({
            id,
            type: e.type || 'taskCompleted',
            revision: e.revision,
            confirmedGrowthPoints: e.growth,
          }))
          .sort((a, b) => a.revision - b.revision),
      delivered(id) {
        save({ ...state, events: { ...state.events, [id]: { ...state.events[id], delivered: true } } });
      },
      wallet: {
        async spend({ operationId, amount, reason }) {
          const old = state.receipts[operationId];
          if (old) {
            if (old.amount !== undefined && (old.amount !== amount || old.reason !== reason))
              throw Error('Operation ID already belongs to another purchase');
            return old;
          }
          const committed = state.balance >= amount;
          const receipt = {
            operationId,
            amount,
            reason,
            status: committed ? 'committed' : 'declined',
            revision: state.revision + (committed ? 1 : 0),
          };
          save({
            ...state,
            balance: state.balance - (committed ? amount : 0),
            revision: receipt.revision,
            receipts: { ...state.receipts, [operationId]: receipt },
          });
          return receipt;
        },
      },
    };
  },
};
