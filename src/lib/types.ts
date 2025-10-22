type SSEEvent = {
  type: string;
  argsRaw?: {
    selector?: string;
    elements?: string;
    mode?: string;
  };
};

type DSFetchEvent = CustomEvent<{
  detail: {
    el: HTMLElement;
    rawArgs: string;
  };
}>;
type DSFetchDetail = {
  el: HTMLElement;
  rawArgs: string;
};

type SignalEvent = {
  type: string;
  argsRaw?: {
    selector?: string;
    elements?: string;
    mode?: string;
  };
};

export { SSEEvent, SignalEvent, DSFetchEvent, DSFetchDetail };
