export function createCadId(prefix: string): string {
  return `${prefix}-${createRandomSegment()}`
}

function createRandomSegment(): string {
  const cryptoApi = globalThis.crypto
  try {
    if (typeof cryptoApi?.randomUUID === 'function') {
      return cryptoApi.randomUUID().slice(0, 8)
    }
  } catch {
    // Some public HTTP deployments expose crypto but block randomUUID.
  }
  try {
    if (typeof cryptoApi?.getRandomValues === 'function') {
      const values = new Uint8Array(4)
      cryptoApi.getRandomValues(values)
      return [...values].map((value) => value.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    // Fall through to Math.random so CAD commands still work offline/insecurely.
  }
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
}
