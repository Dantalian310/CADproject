import WebSocket from '../../frontend/node_modules/ws/wrapper.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:8080'
const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws'

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`[PASS] ${message}`)
}

async function api(method, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(`${method} ${path} failed: ${response.status} ${data.message}`)
  }
  return data.data
}

function frame(command, headers = {}, body = '') {
  const lines = [command, ...Object.entries(headers).map(([key, value]) => `${key}:${value}`), '', body]
  return `${lines.join('\n')}\0`
}

function parseFrames(raw) {
  return raw
    .toString()
    .split('\0')
    .filter(Boolean)
    .map((chunk) => {
      const [head, ...bodyParts] = chunk.split('\n\n')
      const [command, ...headerLines] = head.split('\n').filter(Boolean)
      const headers = Object.fromEntries(headerLines.map((line) => {
        const index = line.indexOf(':')
        return [line.slice(0, index), line.slice(index + 1)]
      }))
      const body = bodyParts.join('\n\n')
      return { command, headers, body }
    })
}

async function waitFor(messages, predicate, label, timeoutMs = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const found = messages.find(predicate)
    if (found) return found
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '')
const username = `wsowner${stamp}`

console.log(`Cloud CAD WebSocket smoke test against ${wsUrl}`)

const ownerAuth = await api('POST', '/api/auth/register', {
  username,
  email: `${username}@example.com`,
  password: 'Password123'
})
const token = ownerAuth.token
assert(Boolean(token), 'owner registration returns token')

const project = await api('POST', '/api/projects', {
  name: `WS Smoke Project ${stamp}`,
  description: 'Created by ws-smoke.mjs'
}, token)
const documentId = project.defaultDocumentId
assert(documentId > 0, 'project creation returns default document')

const ws = new WebSocket(wsUrl)
const messages = []
ws.on('message', (data) => {
  for (const parsed of parseFrames(data)) {
    messages.push(parsed)
  }
})

await new Promise((resolve, reject) => {
  ws.once('open', resolve)
  ws.once('error', reject)
})

ws.send(frame('CONNECT', {
  'accept-version': '1.2',
  host: 'localhost',
  'heart-beat': '0,0',
  Authorization: `Bearer ${token}`
}))

await waitFor(messages, (item) => item.command === 'CONNECTED', 'CONNECTED frame')
assert(true, 'STOMP CONNECT succeeds')

ws.send(frame('SUBSCRIBE', { id: 'presence-sub', destination: `/topic/documents/${documentId}/presence` }))
ws.send(frame('SUBSCRIBE', { id: 'operation-sub', destination: `/topic/documents/${documentId}/operations` }))
ws.send(frame('SUBSCRIBE', { id: 'cursor-sub', destination: `/topic/documents/${documentId}/cursor` }))
ws.send(frame('SUBSCRIBE', { id: 'system-sub', destination: `/topic/documents/${documentId}/system` }))

ws.send(frame('SEND', { destination: `/app/documents/${documentId}/join`, 'content-type': 'application/json' }, '{}'))
const presenceFrame = await waitFor(messages, (item) => item.command === 'MESSAGE' && item.headers.destination?.endsWith('/presence'), 'presence message')
const presence = JSON.parse(presenceFrame.body)
assert(presence.type === 'presence.update', 'presence update envelope received')
assert(Array.isArray(presence.payload.onlineUsers) && presence.payload.onlineUsers.length >= 1, 'presence contains online users')

ws.send(frame('SEND', { destination: `/app/documents/${documentId}/cursor`, 'content-type': 'application/json' }, JSON.stringify({ x: 120, y: 80 })))
const cursorFrame = await waitFor(messages, (item) => item.command === 'MESSAGE' && item.headers.destination?.endsWith('/cursor'), 'cursor message')
const cursorEnvelope = JSON.parse(cursorFrame.body)
assert(cursorEnvelope.type === 'cursor.update', 'cursor update envelope received')
assert(cursorEnvelope.payload.username === username && cursorEnvelope.payload.x === 120 && cursorEnvelope.payload.y === 80, 'cursor payload broadcasts pointer position')

const operation = {
  operationId: `ws-op-${stamp}`,
  documentId,
  type: 'sketch.entity.created',
  targetId: `ws-rect-${stamp}`,
  baseVersion: 1,
  clientId: `ws-client-${stamp}`,
  clientRevision: 0,
  payload: {
    sketchId: 'sketch-001',
    entity: {
      id: `ws-rect-${stamp}`,
      type: 'rectangle',
      name: 'WS Rectangle',
      visible: true,
      origin: { x: 10, y: 10 },
      width: 20,
      height: 15
    },
    documentSnapshot: {
      schemaVersion: '1.0',
      documentId: String(documentId),
      name: `WS Smoke Project ${stamp}`,
      unit: 'mm',
      metadata: { currentVersion: 1 },
      sketches: [{
        id: 'sketch-001',
        name: 'Sketch 1',
        plane: 'XY',
        entities: [{
          id: `ws-rect-${stamp}`,
          type: 'rectangle',
          name: 'WS Rectangle',
          visible: true,
          origin: { x: 10, y: 10 },
          width: 20,
          height: 15
        }],
        constraints: []
      }],
      features: [],
      assemblies: []
    }
  },
  clientTimestamp: new Date().toISOString()
}
ws.send(frame('SEND', { destination: `/app/documents/${documentId}/operations`, 'content-type': 'application/json' }, JSON.stringify(operation)))

const operationFrame = await waitFor(messages, (item) => item.command === 'MESSAGE' && item.headers.destination?.endsWith('/operations'), 'operation message')
const operationEnvelope = JSON.parse(operationFrame.body)
assert(operationEnvelope.type === 'operation.applied', 'operation envelope received')
assert(operationEnvelope.payload.operationId === operation.operationId, 'operation payload echoes operation id')
assert(operationEnvelope.payload.clientId === operation.clientId, 'operation payload echoes realtime client id')
assert(operationEnvelope.payload.serverRevision >= 1, 'operation payload includes realtime server revision')

const liveDocument = await api('GET', `/api/documents/${documentId}`, undefined, token)
const liveEntities = liveDocument.snapshotJson.sketches.flatMap((sketch) => sketch.entities)
assert(liveEntities.some((entity) => entity.id === operation.targetId), 'operation documentSnapshot updates live document snapshot')

const systemMessageCountBeforeSoloOperation = messages.filter((item) => item.command === 'MESSAGE' && item.headers.destination?.endsWith('/system')).length
const soloFollowUpOperation = {
  ...operation,
  operationId: `ws-solo-follow-${stamp}`,
  targetId: `ws-solo-follow-${stamp}`,
  baseVersion: 1,
  clientRevision: 0,
  payload: {
    ...operation.payload,
    entity: {
      ...operation.payload.entity,
      id: `ws-solo-follow-${stamp}`
    }
  }
}
ws.send(frame('SEND', { destination: `/app/documents/${documentId}/operations`, 'content-type': 'application/json' }, JSON.stringify(soloFollowUpOperation)))
await waitFor(messages, (item) => item.command === 'MESSAGE' && item.headers.destination?.endsWith('/operations') && JSON.parse(item.body).payload.operationId === soloFollowUpOperation.operationId, 'solo follow-up operation message')
await delay(600)
const systemMessageCountAfterSoloOperation = messages.filter((item) => item.command === 'MESSAGE' && item.headers.destination?.endsWith('/system')).length
assert(systemMessageCountAfterSoloOperation === systemMessageCountBeforeSoloOperation, 'single-user stale collaboration revision does not broadcast conflict warning')

const staleOperation = {
  ...operation,
  operationId: `ws-conflict-${stamp}`,
  targetId: `ws-conflict-rect-${stamp}`,
  clientRevision: 0,
  baseVersion: 0,
  payload: {
    ...operation.payload,
    entity: {
      ...operation.payload.entity,
      id: `ws-conflict-rect-${stamp}`
    }
  }
}
ws.send(frame('SEND', { destination: `/app/documents/${documentId}/operations`, 'content-type': 'application/json' }, JSON.stringify(staleOperation)))
const conflictFrame = await waitFor(messages, (item) => item.command === 'MESSAGE' && item.headers.destination?.endsWith('/system'), 'conflict warning message')
const conflictEnvelope = JSON.parse(conflictFrame.body)
assert(conflictEnvelope.type === 'conflict.warning', 'stale operation broadcasts conflict warning')
assert(Boolean(conflictEnvelope.payload.reason), 'conflict warning includes reason')

ws.send(frame('DISCONNECT', { receipt: 'close-1' }))
ws.close()

console.log('Cloud CAD WebSocket smoke test completed.')
