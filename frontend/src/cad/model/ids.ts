export function createCadId(prefix: string): string {
  return `${prefix}-${createRandomSegment()}`
}

function createRandomSegment(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().slice(0, 8)
  }
  if (cryptoApi?.getRandomValues) {
    const values = new Uint8Array(4)
    cryptoApi.getRandomValues(values)
    return [...values].map((value) => value.toString(16).padStart(2, '0')).join('')
  }
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
}
