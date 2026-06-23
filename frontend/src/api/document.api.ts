import { http, unwrap } from './http'
import type { CreateDocumentRequest, DocumentDTO, SaveDocumentRequest } from './types'

export function listDocuments(projectId: number): Promise<DocumentDTO[]> {
  return unwrap(http.get(`/api/projects/${projectId}/documents`))
}

export function createDocument(projectId: number, request: CreateDocumentRequest): Promise<DocumentDTO> {
  return unwrap(http.post(`/api/projects/${projectId}/documents`, request))
}

export function getDocument(documentId: number): Promise<DocumentDTO> {
  return unwrap(http.get(`/api/documents/${documentId}`))
}

export function saveDocument(documentId: number, request: SaveDocumentRequest): Promise<DocumentDTO> {
  return unwrap(http.put(`/api/documents/${documentId}/save`, request))
}

export async function exportDocumentJson(documentId: number): Promise<Blob> {
  const response = await http.get(`/api/documents/${documentId}/export-json`, {
    responseType: 'blob'
  })
  return response.data
}
