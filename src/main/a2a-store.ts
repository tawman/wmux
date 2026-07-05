// Lightweight agent-to-agent message store: a per-recipient FIFO inbox that lets one
// pane (addressed by its WMUX_SURFACE_ID, or a logical role) leave a structured message
// for another, which the recipient drains on its own schedule. This is the inbound half
// of coordinator<->worker messaging — the outbound half (injecting text into a pane) already
// exists via surface.send_text. Messages live in memory only: an orchestration is a live
// session, and losing queued messages on an app restart is acceptable (durability can be
// layered in later without changing this interface).

export interface A2AMessage {
  /** Monotonic per-store id, e.g. "a2a-42". */
  id: string;
  /** Sender address (a surfaceId or a logical role). Free-form; not validated. */
  from: string;
  /** Recipient address (a surfaceId or a logical role). */
  to: string;
  /** Optional message type so recipients can dispatch, e.g. "task" | "result" | "status". */
  kind?: string;
  /** Arbitrary JSON payload. */
  payload: unknown;
  /** Epoch milliseconds when the message was accepted. */
  ts: number;
}

export interface A2AInboxStatus {
  to: string;
  count: number;
}

export class A2AStore {
  private readonly inboxes = new Map<string, A2AMessage[]>();
  private readonly maxPerInbox: number;
  private seq = 0;

  /**
   * @param maxPerInbox Cap per recipient so a never-polling inbox can't grow without bound;
   *   the oldest messages are dropped once the cap is exceeded.
   */
  constructor(maxPerInbox = 1000) {
    this.maxPerInbox = maxPerInbox;
  }

  /** Queue a message for its recipient. Returns the stored message (with id + ts assigned). */
  send(msg: { to: string; from: string; kind?: string; payload: unknown; ts?: number }): A2AMessage {
    if (!msg.to) throw new Error('a2a: "to" is required');
    if (!msg.from) throw new Error('a2a: "from" is required');

    const stored: A2AMessage = {
      id: `a2a-${++this.seq}`,
      from: msg.from,
      to: msg.to,
      kind: msg.kind,
      payload: msg.payload,
      ts: msg.ts ?? Date.now(),
    };

    const box = this.inboxes.get(stored.to) ?? [];
    box.push(stored);
    if (box.length > this.maxPerInbox) {
      box.splice(0, box.length - this.maxPerInbox);
    }
    this.inboxes.set(stored.to, box);
    return stored;
  }

  /**
   * Return a recipient's queued messages. Drains (clears) the inbox by default so each
   * message is delivered once; pass `{ drain: false }` to peek without consuming.
   */
  poll(to: string, opts: { drain?: boolean } = {}): A2AMessage[] {
    const box = this.inboxes.get(to) ?? [];
    if (opts.drain === false) {
      return [...box];
    }
    if (box.length > 0) {
      this.inboxes.set(to, []);
    }
    return box;
  }

  /** Non-draining view of a recipient's inbox. */
  peek(to: string): A2AMessage[] {
    return [...(this.inboxes.get(to) ?? [])];
  }

  /** Per-recipient queue depths, for diagnostics. */
  status(): A2AInboxStatus[] {
    return Array.from(this.inboxes.entries())
      .filter(([, box]) => box.length > 0)
      .map(([to, box]) => ({ to, count: box.length }));
  }
}
