import { describe, it, expect } from 'vitest';
import { A2AStore } from '../../src/main/a2a-store';

describe('A2AStore', () => {
  it('delivers a message to its recipient and drains on poll', () => {
    const store = new A2AStore();
    store.send({ to: 'surf-worker', from: 'surf-coord', kind: 'task', payload: { step: 1 } });

    const first = store.poll('surf-worker');
    expect(first).toHaveLength(1);
    expect(first[0].from).toBe('surf-coord');
    expect(first[0].kind).toBe('task');
    expect(first[0].payload).toEqual({ step: 1 });
    expect(first[0].id).toMatch(/^a2a-\d+$/);

    // Drained: a second poll is empty.
    expect(store.poll('surf-worker')).toEqual([]);
  });

  it('preserves FIFO order and keeps recipients isolated', () => {
    const store = new A2AStore();
    store.send({ to: 'a', from: 'x', payload: 1 });
    store.send({ to: 'b', from: 'x', payload: 2 });
    store.send({ to: 'a', from: 'x', payload: 3 });

    expect(store.poll('a').map((m) => m.payload)).toEqual([1, 3]);
    expect(store.poll('b').map((m) => m.payload)).toEqual([2]);
  });

  it('peek and poll{drain:false} do not consume', () => {
    const store = new A2AStore();
    store.send({ to: 'a', from: 'x', payload: 'keep' });

    expect(store.peek('a')).toHaveLength(1);
    expect(store.poll('a', { drain: false })).toHaveLength(1);
    // Still there after peeking.
    expect(store.poll('a')).toHaveLength(1);
    expect(store.poll('a')).toEqual([]);
  });

  it('returns an empty array for an unknown recipient', () => {
    const store = new A2AStore();
    expect(store.poll('nobody')).toEqual([]);
    expect(store.peek('nobody')).toEqual([]);
  });

  it('bounds an inbox by dropping the oldest messages', () => {
    const store = new A2AStore(3);
    for (let i = 1; i <= 5; i++) {
      store.send({ to: 'a', from: 'x', payload: i });
    }
    // Only the last 3 survive, oldest-first.
    expect(store.poll('a').map((m) => m.payload)).toEqual([3, 4, 5]);
  });

  it('reports non-empty inbox depths via status()', () => {
    const store = new A2AStore();
    store.send({ to: 'a', from: 'x', payload: 1 });
    store.send({ to: 'a', from: 'x', payload: 2 });
    store.send({ to: 'b', from: 'x', payload: 3 });

    expect(store.status()).toEqual(
      expect.arrayContaining([
        { to: 'a', count: 2 },
        { to: 'b', count: 1 },
      ]),
    );

    store.poll('a');
    expect(store.status()).toEqual([{ to: 'b', count: 1 }]);
  });

  it('requires both to and from', () => {
    const store = new A2AStore();
    expect(() => store.send({ to: '', from: 'x', payload: 1 })).toThrow(/to/);
    expect(() => store.send({ to: 'a', from: '', payload: 1 })).toThrow(/from/);
  });
});
