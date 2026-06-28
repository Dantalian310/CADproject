export type CadOperationType =
  | 'sketch.entity.created'
  | 'sketch.entities.created'
  | 'sketch.entity.updated'
  | 'sketch.entities.updated'
  | 'sketch.entity.deleted'
  | 'sketch.entities.deleted'
  | 'constraint.added'
  | 'constraint.updated'
  | 'constraint.removed'
  | 'feature.created'
  | 'feature.updated'
  | 'feature.deleted'
  | 'history.undo'
  | 'history.redo'
  | 'document.saved'
  | 'version.restored'

export interface CadOperation {
  operationId: string
  documentId: number
  type: CadOperationType
  targetId: string
  baseVersion: number
  clientId?: string
  clientRevision?: number
  serverRevision?: number
  authorUserId?: number | string
  payload: Record<string, unknown>
  clientTimestamp: string
}
