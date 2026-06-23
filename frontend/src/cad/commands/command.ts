import type { CadDocument } from '@/cad/model/document'
import type { CadOperation } from '@/cad/model/operation'

export interface CadCommand {
  id: string
  type: string
  execute(document: CadDocument): CadDocument
  undo(document: CadDocument): CadDocument
  toOperation(documentId: number, baseVersion: number): CadOperation
}
