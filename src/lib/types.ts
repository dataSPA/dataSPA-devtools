type SSEEvent = {
  type: string;
  argsRaw?: {
    selector?: string;
    elements?: string;
    mode?: string;
  };
  el?: string;
};

type DSFetchEvent = CustomEvent<{
  detail: {
    el: HTMLElement;
    argsRaw: string;
  };
}>;

type DSFetchDetail = {
  el: HTMLElement;
  argsRaw: string;
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
