import type { CadDocument } from '@/cad/model/document'
import type { CadCommand } from './command'

export class HistoryStack {
  private undoStack: CadCommand[] = []
  private redoStack: CadCommand[] = []

  push(command: CadCommand): void {
    this.undoStack.push(command)
    this.redoStack = []
  }

  undo(document: CadDocument): CadDocument {
    const command = this.undoStack.pop()
    if (!command) return document
    this.redoStack.push(command)
    return command.undo(document)
  }

  redo(document: CadDocument): CadDocument {
    const command = this.redoStack.pop()
    if (!command) return document
    this.undoStack.push(command)
    return command.execute(document)
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
