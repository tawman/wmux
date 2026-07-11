import { StateCreator } from 'zustand';

// ─── OSC 9;4 progress tracking (issue: xterm 6 follow-up) ────────────────────
// The ProgressAddon in useTerminal reports ConEmu/Windows Terminal progress
// sequences per surface. States follow the OSC 9;4 convention:
//   1 = normal (value 0-100), 2 = error, 3 = indeterminate, 4 = paused/warning.
// State 0 (remove) never appears here — it deletes the entry instead, so
// "has progress" is simply "surfaceId present in the map".

export interface SurfaceProgress {
  state: 1 | 2 | 3 | 4;
  /** 0-100. Ignored for state 3 (indeterminate). */
  value: number;
}

export interface ProgressSlice {
  surfaceProgress: Record<string, SurfaceProgress>;
  /** Set or update a surface's progress; pass null to remove (state 0 / PTY exit). */
  setSurfaceProgress: (surfaceId: string, progress: SurfaceProgress | null) => void;
}

/**
 * Combine several surfaces' progress into one indicator (workspace row,
 * taskbar). Error trumps everything so a failed build is never masked by a
 * healthy sibling; determinate beats indeterminate so a real percentage wins;
 * the value averages the determinate entries.
 */
export function aggregateProgress(entries: SurfaceProgress[]): SurfaceProgress | null {
  if (entries.length === 0) return null;
  const determinate = entries.filter(e => e.state !== 3);
  const value = determinate.length > 0
    ? Math.round(determinate.reduce((sum, e) => sum + e.value, 0) / determinate.length)
    : 0;
  if (entries.some(e => e.state === 2)) return { state: 2, value };
  if (entries.some(e => e.state === 1)) return { state: 1, value };
  if (entries.some(e => e.state === 4)) return { state: 4, value };
  return { state: 3, value: 0 };
}

export const createProgressSlice: StateCreator<ProgressSlice, [], [], ProgressSlice> = (set) => ({
  surfaceProgress: {},

  setSurfaceProgress: (surfaceId, progress) =>
    set((state) => {
      const existing = state.surfaceProgress[surfaceId];
      if (progress === null) {
        if (!existing) return state; // nothing to remove — avoid a no-op re-render
        const next = { ...state.surfaceProgress };
        delete next[surfaceId];
        return { surfaceProgress: next };
      }
      // Progress sequences can arrive at high frequency during busy output;
      // dropping identical updates keeps re-renders proportional to change.
      if (existing && existing.state === progress.state && existing.value === progress.value) {
        return state;
      }
      return { surfaceProgress: { ...state.surfaceProgress, [surfaceId]: progress } };
    }),
});
