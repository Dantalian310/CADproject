export function createCadId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}
