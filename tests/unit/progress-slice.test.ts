import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import {
  createProgressSlice,
  ProgressSlice,
  SurfaceProgress,
  aggregateProgress,
} from '../../src/renderer/store/progress-slice';

function makeStore() {
  return create<ProgressSlice>()((...args) => ({
    ...createProgressSlice(...args),
  }));
}

describe('progress-slice', () => {
  let useStore: ReturnType<typeof makeStore>;

  beforeEach(() => {
    useStore = makeStore();
  });

  it('starts with no progress entries', () => {
    expect(useStore.getState().surfaceProgress).toEqual({});
  });

  it('setSurfaceProgress stores an entry keyed by surface', () => {
    useStore.getState().setSurfaceProgress('surf-1', { state: 1, value: 42 });
    expect(useStore.getState().surfaceProgress['surf-1']).toEqual({ state: 1, value: 42 });
  });

  it('updates an existing entry', () => {
    useStore.getState().setSurfaceProgress('surf-1', { state: 1, value: 10 });
    useStore.getState().setSurfaceProgress('surf-1', { state: 1, value: 90 });
    expect(useStore.getState().surfaceProgress['surf-1']).toEqual({ state: 1, value: 90 });
  });

  it('null removes the entry (state 0 / PTY exit)', () => {
    useStore.getState().setSurfaceProgress('surf-1', { state: 1, value: 50 });
    useStore.getState().setSurfaceProgress('surf-1', null);
    expect(useStore.getState().surfaceProgress).toEqual({});
  });

  it('removing a missing entry does not create a new state object', () => {
    const before = useStore.getState().surfaceProgress;
    useStore.getState().setSurfaceProgress('surf-none', null);
    expect(useStore.getState().surfaceProgress).toBe(before);
  });

  it('identical updates are dropped (no re-render churn)', () => {
    useStore.getState().setSurfaceProgress('surf-1', { state: 1, value: 42 });
    const before = useStore.getState().surfaceProgress;
    useStore.getState().setSurfaceProgress('surf-1', { state: 1, value: 42 });
    expect(useStore.getState().surfaceProgress).toBe(before);
  });

  it('tracks multiple surfaces independently', () => {
    useStore.getState().setSurfaceProgress('surf-1', { state: 1, value: 25 });
    useStore.getState().setSurfaceProgress('surf-2', { state: 3, value: 0 });
    useStore.getState().setSurfaceProgress('surf-1', null);
    expect(useStore.getState().surfaceProgress).toEqual({ 'surf-2': { state: 3, value: 0 } });
  });
});

describe('aggregateProgress', () => {
  const p = (state: 1 | 2 | 3 | 4, value: number): SurfaceProgress => ({ state, value });

  it('returns null for no entries', () => {
    expect(aggregateProgress([])).toBeNull();
  });

  it('single normal entry passes through', () => {
    expect(aggregateProgress([p(1, 70)])).toEqual({ state: 1, value: 70 });
  });

  it('averages determinate values', () => {
    expect(aggregateProgress([p(1, 20), p(1, 80)])).toEqual({ state: 1, value: 50 });
  });

  it('error trumps normal and keeps the averaged value', () => {
    expect(aggregateProgress([p(1, 40), p(2, 60)])).toEqual({ state: 2, value: 50 });
  });

  it('normal trumps paused', () => {
    expect(aggregateProgress([p(4, 40), p(1, 60)])).toEqual({ state: 1, value: 50 });
  });

  it('paused wins over indeterminate only', () => {
    expect(aggregateProgress([p(4, 30), p(3, 0)])).toEqual({ state: 4, value: 30 });
  });

  it('all indeterminate stays indeterminate', () => {
    expect(aggregateProgress([p(3, 0), p(3, 0)])).toEqual({ state: 3, value: 0 });
  });

  it('indeterminate entries are excluded from the average', () => {
    expect(aggregateProgress([p(1, 90), p(3, 0)])).toEqual({ state: 1, value: 90 });
  });
});
