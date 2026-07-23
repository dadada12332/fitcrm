import { createAdapter as createMockAdapter } from "./mock.mjs"

export async function loadAdapter(config, dependencies) {
  const factories = {
    mock: async () => createMockAdapter,
    sigur: async () => (await import("./sigur.mjs")).createAdapter,
    zkteco: async () => (await import("./zkteco.mjs")).createAdapter,
    hikvision: async () => (await import("./hikvision.mjs")).createAdapter,
  }
  const load = factories[config.type]
  if (!load) throw new Error(`Unsupported provider adapter: ${config.type}`)
  return (await load())(config, dependencies)
}
