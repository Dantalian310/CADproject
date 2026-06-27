import type { CadDocument } from '@/cad/model/document'

export interface ApiResponse<T> {
  success: boolean
  code: string
  message: string
  data: T
}

export interface UserDTO {
  id: number
  username: string
  email?: string
  displayName?: string
}

export interface AuthResponse {
  token: string
  user: UserDTO
}

export interface ProjectDTO {
  id: number
  name: string
  description?: string
  ownerId: number
  myRole: ProjectRole
  defaultDocumentId?: number
  createdAt?: string
  updatedAt?: string
}

export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type ProjectInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELED'

export interface ProjectMemberDTO {
  id: number
  projectId: number
  user: UserDTO
  role: ProjectRole
  createdAt?: string
}

export interface ProjectInvitationDTO {
  id: number
  projectId: number
  projectName: string
  inviter: UserDTO
  invitee: UserDTO
  role: Exclude<ProjectRole, 'OWNER'>
  status: ProjectInvitationStatus
  createdAt?: string
  updatedAt?: string
  respondedAt?: string
}

export interface DocumentDTO {
  id: number
  projectId: number
  name: string
  description?: string
  currentVersion: number
  snapshotJson: CadDocument
  createdAt?: string
  updatedAt?: string
}

export interface VersionDTO {
  id: number
  documentId: number
  versionNumber: number
  createdBy: Pick<UserDTO, 'id' | 'username' | 'displayName'>
  message?: string
  createdAt: string
}

export interface VersionDetailDTO extends VersionDTO {
  snapshotJson: CadDocument
}

export interface CreateProjectRequest {
  name: string
  description?: string
}

export interface AddProjectMemberRequest {
  email: string
  role: Exclude<ProjectRole, 'OWNER'>
}

export interface CreateProjectInvitationRequest {
  account: string
  role: Exclude<ProjectRole, 'OWNER'>
}

export interface UpdateMemberRoleRequest {
  role: Exclude<ProjectRole, 'OWNER'>
}

export interface CreateDocumentRequest {
  name: string
  description?: string
}

export interface UpdateDocumentRequest {
  name: string
  description?: string
}

export interface SaveDocumentRequest {
  baseVersion: number
  snapshotJson: CadDocument
  message?: string
}

export interface RestoreVersionRequest {
  message?: string
}
