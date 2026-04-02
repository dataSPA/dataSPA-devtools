type SSEEvent = {
  id: string;
  replayed?: boolean;
  type: string;
  argsRaw?: {
    selector?: string;
    elements?: string;
    mode?: string;
    signals?: string;
  };
  el?: string;
};

type SaveSignalMessage = {
  path: string;
  value: any;
};
type DSFetchDetail = {
  el: HTMLElement;
  replayed?: boolean;
  argsRaw: object;
  type: string;
};

type SignalEvent = {
  type: string;
  argsRaw?: {
    selector?: string;
    elements?: string;
    mode?: string;
  };
};

class RingBuffer<T> {
  private capacity: number;
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError("Capacity must be at least 1");
    this.capacity = capacity;
    this.buffer = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  pop(): T | undefined {
    if (this.size === 0) return undefined;
    const item = this.buffer[this.tail] as T;
    this.buffer[this.tail] = undefined; // release reference
    this.tail = (this.tail + 1) % this.capacity;
    this.size--;
    return item;
  }

  peek(): T | undefined {
    if (this.size === 0) return undefined;
    return this.buffer[this.tail] as T;
  }

  toArray(): T[] {
    return Array.from(
      { length: this.size },
      (_, i) => this.buffer[(this.tail + i) % this.capacity] as T,
    );
  }

  resize(newCapacity: number): void {
    if (newCapacity < 1) throw new RangeError("Capacity must be at least 1");

    const items = this.toArray();
    const keep = items.slice(-newCapacity); // drop oldest if shrinking

    this.capacity = newCapacity;
    this.buffer = new Array<T | undefined>(newCapacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;

    for (const item of keep) this.push(item);
  }

  getCapacity(): number {
    return this.capacity;
  }
  getSize(): number {
    return this.size;
  }
  isFull(): boolean {
    return this.size === this.capacity;
  }
  isEmpty(): boolean {
    return this.size === 0;
  }
}

// Message types crossing the page → content → background → panel bridge
type BridgeEventMessage = {
  source: string;
  version: number;
  type: string;
  payload: {
    data: string;
    el?: string;
    error?: string;
  };
};

// Structured message sent from the background to devtools panel ports
type PanelPatchMessage = {
  type: "patch-elements";
  selector?: string;
  mode?: "replace" | "append" | "prepend" | "inner" | "outer";
  elements: string;
};

type PanelSignalMessage = {
  type: "patch-signals";
  signals: string;
};

/** Response from the offscreen document after rendering an HTML tree. */
type HtmlTreeResponse = {
  ok: boolean;
  /** Serialised ht-* tree HTML, present when ok is true. */
  html?: string;
  error?: string;
};

type PanelMessage = PanelPatchMessage | PanelSignalMessage;

export {
  type SSEEvent,
  type SignalEvent,
  type DSFetchDetail,
  RingBuffer,
  type BridgeEventMessage,
  type HtmlTreeResponse,
  type PanelPatchMessage,
  type PanelSignalMessage,
  type PanelMessage,
  type SaveSignalMessage,
};
