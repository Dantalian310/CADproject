export type CadSelection =
  | { kind: 'document'; documentId: string }
  | { kind: 'sketch'; sketchId: string }
  | { kind: 'sketch-entity'; sketchId: string; entityId: string }
  | { kind: 'sketch-entities'; entities: Array<{ sketchId: string; entityId: string }> }
  | { kind: 'feature'; featureId: string }
  | { kind: 'features'; featureIds: string[] }
