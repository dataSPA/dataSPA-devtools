import { writable } from "svelte/store";
import type { StorageItemKey } from "wxt/utils/storage";

export function createStore<T>(value: T, storageKey: StorageItemKey) {
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
