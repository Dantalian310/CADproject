import { http, unwrap } from './http'
import type { DocumentDTO, RestoreVersionRequest, VersionDTO, VersionDetailDTO } from './types'

export function listVersions(documentId: number): Promise<VersionDTO[]> {
  return unwrap(http.get(`/api/documents/${documentId}/versions`))
}

export function getVersion(documentId: number, versionId: number): Promise<VersionDetailDTO> {
  return unwrap(http.get(`/api/documents/${documentId}/versions/${versionId}`))
}

export function restoreVersion(
  documentId: number,
  versionId: number,
  request: RestoreVersionRequest
): Promise<DocumentDTO> {
  return unwrap(http.post(`/api/documents/${documentId}/versions/${versionId}/restore`, request))
}
