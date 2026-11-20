export function createSurfaceStorage(host) {
  return {
    get(key, options) {
      return host.call("host.platform", "storage.get", { key }, options);
    },
    async set(key, value, options) {
      await host.call("host.platform", "storage.set", { key, value }, options);
    },
    async remove(key, options) {
      await host.call("host.platform", "storage.remove", { key }, options);
    },
  };
}
