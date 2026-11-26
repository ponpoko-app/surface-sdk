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
    async getJson(key, fallback = null, options) {
      const raw = await host.call("host.platform", "storage.get", { key }, options);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    },
    async setJson(key, value, options) {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new TypeError("Value cannot be serialized to JSON.");
      await host.call("host.platform", "storage.set", { key, value: serialized }, options);
    },
  };
}
