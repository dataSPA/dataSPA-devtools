import { writable } from "svelte/store";
import type { StorageItemKey } from "wxt/utils/storage";
import { SSEEvent, SignalEvent } from "$lib/types";

export const sseMessages = writable<SSEEvent[]>([]);
export const signalMessages = writable<SignalEvent[]>([]);

export function createStorageStore<T>(value: T, storageKey: StorageItemKey) {
  const { subscribe, set } = writable(value);

  const storageItem = storage.defineItem<T>(storageKey, {
    fallback: value,
  });

  storageItem.getValue().then(set);

  const unwatch = storageItem.watch(set);
  // const unwatch = storageItem.watch((value) => {
  //   set(JSON.parse(value));
  // }); // not sure when or where to call unwatch

  return {
    subscribe,
    set: (value: T) => {
      storageItem.setValue(value);
    },
  };
}

export function createHighlightToggleStore() {
  const { subscribe, set } = writable(false);

  const storageItem = storage.defineItem<boolean>("session:highlightEnabled", {
    fallback: false,
  });

  storageItem.getValue().then(set);

  const unwatch = storageItem.watch(set);

  return {
    subscribe,
    set: (value: boolean) => {
      storageItem.setValue(value);
    },
  };
}
