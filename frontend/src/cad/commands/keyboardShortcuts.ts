import type { CadToolType } from '@/stores/cad.store'
import type { CadViewPreset } from '@/cad/geometry/sceneManager'

export type CadKeyboardAction =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'duplicate' }
  | { type: 'delete' }
  | { type: 'cancel' }
  | { type: 'deselect' }
  | { type: 'toggle-construction' }
  | { type: 'set-tool'; tool: CadToolType }
  | { type: 'view'; command: CadViewPreset | 'fit' }

export interface CadKeyboardShortcutInput {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

const toolShortcuts: Record<string, CadToolType> = {
  a: 'arc',
  c: 'circle',
  d: 'dimension',
  h: 'horizontal',
  l: 'line',
  r: 'rectangle',
  t: 'tangent',
  v: 'vertical'
}

export function resolveCadKeyboardAction(event: CadKeyboardShortcutInput): CadKeyboardAction | null {
  const key = event.key.toLowerCase()
  const commandModifier = Boolean(event.ctrlKey || event.metaKey)

  if (commandModifier && key === 'z' && !event.shiftKey) {
    return { type: 'undo' }
  }
  if (commandModifier && (key === 'y' || (key === 'z' && event.shiftKey))) {
    return { type: 'redo' }
  }
  if (commandModifier && key === 'd') {
    return { type: 'duplicate' }
  }
  if (commandModifier || event.altKey) {
    return null
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    return { type: 'delete' }
  }
  if (event.key === 'Escape') {
    return { type: 'cancel' }
  }
  if (event.key === ' ') {
    return { type: 'deselect' }
  }

  if (event.shiftKey) {
    if (key === 'e') return { type: 'set-tool', tool: 'extrude' }
    if (key === 'x') return { type: 'set-tool', tool: 'cut' }
    if (key === '1') return { type: 'view', command: 'front' }
    if (key === '5') return { type: 'view', command: 'top' }
    if (key === '7') return { type: 'view', command: 'isometric' }
    return null
  }

  if (key === 'f') return { type: 'view', command: 'fit' }
  if (key === 'q') return { type: 'toggle-construction' }
  if (key === 's') return { type: 'set-tool', tool: 'select' }

  const tool = toolShortcuts[key]
  return tool ? { type: 'set-tool', tool } : null
}
