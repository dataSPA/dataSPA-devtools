type SSEEvent = {
  id: string
  type: string
  argsRaw?: {
    selector?: string
    elements?: string
    mode?: string
  }
  el?: string
}

type DSFetchDetail = {
  el: HTMLElement
  argsRaw: object
  type: string
}

type SignalEvent = {
  type: string
  argsRaw?: {
    selector?: string
    elements?: string
    mode?: string
  }
}

class RingBuffer<T> {
  private capacity: number
  private buffer: (T | undefined)[]
  private head: number = 0
  private tail: number = 0
  private size: number = 0

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('Capacity must be at least 1')
    this.capacity = capacity
    this.buffer = new Array<T | undefined>(capacity)
  }

  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity

    if (this.size < this.capacity) {
      this.size++
    } else {
      this.tail = (this.tail + 1) % this.capacity
    }
  }

  pop(): T | undefined {
    if (this.size === 0) return undefined
    const item = this.buffer[this.tail] as T
    this.buffer[this.tail] = undefined // release reference
    this.tail = (this.tail + 1) % this.capacity
    this.size--
    return item
  }

  peek(): T | undefined {
    if (this.size === 0) return undefined
    return this.buffer[this.tail] as T
  }

  toArray(): T[] {
    return Array.from(
      { length: this.size },
      (_, i) => this.buffer[(this.tail + i) % this.capacity] as T,
    )
  }

  resize(newCapacity: number): void {
    if (newCapacity < 1) throw new RangeError('Capacity must be at least 1')

    const items = this.toArray()
    const keep = items.slice(-newCapacity) // drop oldest if shrinking

    this.capacity = newCapacity
    this.buffer = new Array<T | undefined>(newCapacity)
    this.head = 0
    this.tail = 0
    this.size = 0

    for (const item of keep) this.push(item)
  }

  getCapacity(): number {
    return this.capacity
  }
  getSize(): number {
    return this.size
  }
  isFull(): boolean {
    return this.size === this.capacity
  }
  isEmpty(): boolean {
    return this.size === 0
  }
}

// Message types crossing the page → content → background → panel bridge
type BridgeEventMessage = {
  source: string
  version: number
  type: string
  payload: {
    data: string
    el?: string
    error?: string
  }
}

// Structured message sent from the background to devtools panel ports
type PanelPatchMessage = {
  type: 'patch-elements'
  selector?: string
  mode?: 'replace' | 'append' | 'prepend' | 'inner' | 'outer'
  elements: string
}

type PanelSignalMessage = {
  type: 'patch-signals'
  signals: string
}

/** Sent from background → panel to render the raw HTML element tree in the detail pane. */
type PanelElementsMessage = {
  type: 'show-elements'
  /** The raw HTML string from `SSEEvent.argsRaw.elements`, or null to clear. */
  elements: string | null
}

type PanelMessage =
  | PanelPatchMessage
  | PanelSignalMessage
  | PanelElementsMessage

export {
  type SSEEvent,
  type SignalEvent,
  type DSFetchDetail,
  RingBuffer,
  type BridgeEventMessage,
  type PanelPatchMessage,
  type PanelSignalMessage,
  type PanelElementsMessage,
  type PanelMessage,
}
