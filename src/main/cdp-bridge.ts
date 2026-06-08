import { webContents } from 'electron';
import { CDPSnapshot } from '../shared/types';

interface RefEntry {
  nodeId: number;
  backendNodeId: number;
}

const SKIP_ROLES = new Set([
  'generic', 'none', 'presentation', 'InlineTextBox', 'LineBreak',
]);

export function buildAccessibilityTree(
  nodes: any[],
): CDPSnapshot & { refMap: Map<string, RefEntry> } {
  const refMap = new Map<string, RefEntry>();
  let refCounter = 0;
  const nodeMap = new Map<number, any>();
  for (const node of nodes) nodeMap.set(node.nodeId, node);

  const lines: string[] = [];

  function walk(nodeId: number, depth: number): void {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const role = node.role?.value || '';
    const name = node.name?.value || '';
    const value = node.value?.value;

    if (SKIP_ROLES.has(role) && !name) {
      for (const childId of node.childIds || []) walk(childId, depth);
      return;
    }

    refCounter++;
    const ref = `@e${refCounter}`;
    refMap.set(ref, { nodeId: node.nodeId, backendNodeId: node.backendNodeId || node.nodeId });

    const indent = '  '.repeat(depth);
    let line = `${indent}${ref}: ${role}`;
    if (name) line += ` "${name}"`;
    if (value !== undefined && value !== '') line += ` value="${value}"`;
    lines.push(line);

    for (const childId of node.childIds || []) walk(childId, depth + 1);
  }

  if (nodes.length > 0) walk(nodes[0].nodeId, 0);

  return { tree: lines.join('\n'), refCount: refCounter, refMap };
}

export function resolveRef(refMap: Map<string, RefEntry>, ref: string): RefEntry | null {
  return refMap.get(ref) ?? null;
}

export class CDPBridge {
  private webContentsId: number | null = null;
  private attached = false;
  private currentRefMap = new Map<string, RefEntry>();

  attach(wcId: number): void {
    this.webContentsId = wcId;
    try {
      const wc = webContents.fromId(wcId);
      if (wc && !wc.debugger.isAttached()) {
        wc.debugger.attach('1.3');
        this.attached = true;
      }
    } catch (err) {
      console.error('[cdp-bridge] Failed to attach:', err);
    }
  }

  // Detach the debugger. When `wcId` is provided, only detach if this bridge is
  // currently attached to that exact webContents — so a closing BrowserPane never
  // tears down a connection that another, still-open pane owns (issue #27).
  detach(wcId?: number): void {
    if (wcId !== undefined && this.webContentsId !== wcId) return;
    if (this.webContentsId !== null) {
      try {
        const wc = webContents.fromId(this.webContentsId);
        if (wc?.debugger.isAttached()) wc.debugger.detach();
      } catch {}
    }
    this.attached = false;
    this.webContentsId = null;
    this.currentRefMap.clear();
  }

  get attachedWebContentsId(): number | null {
    return this.webContentsId;
  }

  get isAttached(): boolean {
    return this.attached && this.webContentsId !== null;
  }

  private getDebugger() {
    if (this.webContentsId === null) throw new Error('browser_not_open');
    let wc;
    try { wc = webContents.fromId(this.webContentsId); } catch { throw new Error('browser_not_open'); }
    if (!wc || wc.isDestroyed() || !wc.debugger.isAttached()) throw new Error('browser_not_open');
    return wc.debugger;
  }

  private async sendCommand(method: string, params?: any): Promise<any> {
    return this.getDebugger().sendCommand(method, params);
  }

  async navigate(url: string, timeout = 30000): Promise<void> {
    if (this.webContentsId === null) throw new Error('browser_not_open');
    let wc;
    try { wc = webContents.fromId(this.webContentsId); } catch { throw new Error('browser_not_open'); }
    if (!wc || wc.isDestroyed()) throw new Error('browser_not_open');
    const loadPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { wc?.removeListener('did-finish-load', onFinish); reject(new Error('timeout')); }, timeout);
      const onFinish = () => { clearTimeout(timer); resolve(); };
      wc?.once('did-finish-load', onFinish);
    });
    await this.sendCommand('Page.navigate', { url });
    await loadPromise;
  }

  async snapshot(): Promise<CDPSnapshot> {
    const result = await this.sendCommand('Accessibility.getFullAXTree');
    const { tree, refCount, refMap } = buildAccessibilityTree(result.nodes || []);
    this.currentRefMap = refMap;
    return { tree, refCount };
  }

  async click(ref: string): Promise<void> {
    const entry = resolveRef(this.currentRefMap, ref);
    if (!entry) throw new Error('ref_not_found');
    const { model } = await this.sendCommand('DOM.getBoxModel', { backendNodeId: entry.backendNodeId });
    const content = model.content;
    const x = (content[0] + content[2] + content[4] + content[6]) / 4;
    const y = (content[1] + content[3] + content[5] + content[7]) / 4;
    await this.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  async type(ref: string, text: string): Promise<void> {
    await this.click(ref);
    for (const char of text) {
      await this.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
      await this.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
    }
  }

  async fill(ref: string, value: string): Promise<void> {
    const entry = resolveRef(this.currentRefMap, ref);
    if (!entry) throw new Error('ref_not_found');
    const { object } = await this.sendCommand('DOM.resolveNode', { backendNodeId: entry.backendNodeId });
    await this.sendCommand('Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration: `function(v) { this.value = v; this.dispatchEvent(new Event('input', {bubbles:true})); }`,
      arguments: [{ value }],
    });
  }

  async screenshot(fullPage = false): Promise<string> {
    const params: any = { format: 'png' };
    if (fullPage) {
      const { contentSize } = await this.sendCommand('Page.getLayoutMetrics');
      params.clip = { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 };
    }
    const { data } = await this.sendCommand('Page.captureScreenshot', params);
    return data;
  }

  async getText(ref?: string): Promise<string> {
    if (ref) {
      const entry = resolveRef(this.currentRefMap, ref);
      if (!entry) throw new Error('ref_not_found');
      const { object } = await this.sendCommand('DOM.resolveNode', { backendNodeId: entry.backendNodeId });
      const result = await this.sendCommand('Runtime.callFunctionOn', {
        objectId: object.objectId, functionDeclaration: 'function() { return this.innerText || this.textContent || ""; }', returnByValue: true,
      });
      return result.result.value || '';
    }
    const result = await this.sendCommand('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true });
    return result.result.value || '';
  }

  async evaluate(js: string): Promise<any> {
    const result = await this.sendCommand('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'eval error');
    return result.result.value;
  }

  async wait(ref?: string, timeout = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (ref) {
        await this.snapshot();
        if (resolveRef(this.currentRefMap, ref)) return;
      } else {
        await new Promise((r) => setTimeout(r, 200));
        return;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error('timeout');
  }
}
