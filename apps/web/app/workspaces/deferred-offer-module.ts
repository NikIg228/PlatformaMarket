export function deferredOfferModule<T>(load: () => Promise<T>) {
  let value: T | undefined;
  let pending: Promise<T> | undefined;
  return {
    current: () => value,
    load() {
      if (value !== undefined) return Promise.resolve(value);
      if (!pending) {
        pending = Promise.resolve().then(load).then(result => {
          value = result;
          return result;
        }).finally(() => { pending = undefined; });
      }
      return pending;
    },
  };
}
