import { describe, it, expect, vi } from 'vitest';

// Minimal fake webContents registry so we can exercise CDPBridge attach/detach
// without a real Electron runtime.
const fakeContents = new Map<number, any>();
function makeWc(id: number) {
  let attached = false;
  const wc = {
    isDestroyed: () => false,
    debugger: {
      isAttached: () => attached,
      attach: () => { attached = true; },
      detach: () => { attached = false; },
    },
  };
  fakeContents.set(id, wc);
  return wc;
}
vi.mock('electron', () => ({
  webContents: { fromId: (id: number) => fakeContents.get(id) },
}));

import { buildAccessibilityTree, resolveRef, CDPBridge } from '../../src/main/cdp-bridge';

describe('CDP Bridge', () => {
  describe('buildAccessibilityTree', () => {
    it('formats AX nodes with refs', () => {
      const nodes = [
        { nodeId: 1, role: { value: 'document' }, name: { value: 'My Page' }, childIds: [2, 3] },
        { nodeId: 2, role: { value: 'button' }, name: { value: 'Submit' }, childIds: [] },
        { nodeId: 3, role: { value: 'textbox' }, name: { value: 'Email' }, value: { value: '' }, childIds: [] },
      ];
      const result = buildAccessibilityTree(nodes);
      expect(result.tree).toContain('@e1: document "My Page"');
      expect(result.tree).toContain('@e2: button "Submit"');
      expect(result.tree).toContain('@e3: textbox "Email"');
      expect(result.refCount).toBe(3);
    });

    it('skips generic nodes without ARIA roles', () => {
      const nodes = [
        { nodeId: 1, role: { value: 'document' }, name: { value: '' }, childIds: [2] },
        { nodeId: 2, role: { value: 'generic' }, name: { value: '' }, childIds: [3] },
        { nodeId: 3, role: { value: 'button' }, name: { value: 'OK' }, childIds: [] },
      ];
      const result = buildAccessibilityTree(nodes);
      expect(result.tree).not.toContain('generic');
      expect(result.tree).toContain('button "OK"');
    });
  });

  describe('resolveRef', () => {
    it('returns entry for valid ref', () => {
      const refMap = new Map([['@e1', { nodeId: 5, backendNodeId: 10 }]]);
      expect(resolveRef(refMap, '@e1')).toEqual({ nodeId: 5, backendNodeId: 10 });
    });

    it('returns null for invalid ref', () => {
      expect(resolveRef(new Map(), '@e99')).toBeNull();
    });
  });

  describe('ownership-aware detach (issue #27)', () => {
    it('ignores detach from a pane that does not own the attachment', () => {
      makeWc(1);
      makeWc(2);
      const bridge = new CDPBridge();
      bridge.attach(1);
      expect(bridge.attachedWebContentsId).toBe(1);

      // A different pane (wcId 2) unmounting must not tear down pane 1's CDP.
      bridge.detach(2);
      expect(bridge.attachedWebContentsId).toBe(1);
      expect(bridge.isAttached).toBe(true);
    });

    it('detaches when the owning pane requests it', () => {
      makeWc(1);
      const bridge = new CDPBridge();
      bridge.attach(1);
      bridge.detach(1);
      expect(bridge.attachedWebContentsId).toBeNull();
      expect(bridge.isAttached).toBe(false);
    });

    it('detaches unconditionally when no wcId is given', () => {
      makeWc(1);
      const bridge = new CDPBridge();
      bridge.attach(1);
      bridge.detach();
      expect(bridge.attachedWebContentsId).toBeNull();
    });
  });
});
