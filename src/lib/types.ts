type SSEEvent = {
  type: string;
  argsRaw?: {
    selector?: string;
    elements?: string;
    mode?: string;
  };
};

type SignalEvent = {
  type: string;
  argsRaw?: {
    selector?: string;
    elements?: string;
    mode?: string;
  };
};

export { SSEEvent, SignalEvent };
