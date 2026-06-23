import { http, unwrap } from './http'
import type {
  AddProjectMemberRequest,
  CreateProjectInvitationRequest,
  CreateProjectRequest,
  ProjectDTO,
  ProjectInvitationDTO,
  ProjectMemberDTO,
  UpdateMemberRoleRequest
} from './types'

export function listProjects(): Promise<ProjectDTO[]> {
  return unwrap(http.get('/api/projects'))
}

export function createProject(request: CreateProjectRequest): Promise<ProjectDTO> {
  return unwrap(http.post('/api/projects', request))
}

export function updateProject(projectId: number, request: CreateProjectRequest): Promise<ProjectDTO> {
  return unwrap(http.patch(`/api/projects/${projectId}`, request))
}

export function getProject(projectId: number): Promise<ProjectDTO> {
  return unwrap(http.get(`/api/projects/${projectId}`))
}

export function deleteProject(projectId: number): Promise<boolean> {
  return unwrap(http.delete(`/api/projects/${projectId}`))
}

export function listProjectMembers(projectId: number): Promise<ProjectMemberDTO[]> {
  return unwrap(http.get(`/api/projects/${projectId}/members`))
}

export function addProjectMember(
  projectId: number,
  request: AddProjectMemberRequest
): Promise<ProjectMemberDTO> {
  return unwrap(http.post(`/api/projects/${projectId}/members`, request))
}

export function listProjectInvitations(projectId: number): Promise<ProjectInvitationDTO[]> {
  return unwrap(http.get(`/api/projects/${projectId}/invitations`))
}

export function createProjectInvitation(
  projectId: number,
  request: CreateProjectInvitationRequest
): Promise<ProjectInvitationDTO> {
  return unwrap(http.post(`/api/projects/${projectId}/invitations`, request))
}

export function cancelProjectInvitation(projectId: number, invitationId: number): Promise<ProjectInvitationDTO> {
  return unwrap(http.delete(`/api/projects/${projectId}/invitations/${invitationId}`))
}

export function listMyPendingInvitations(): Promise<ProjectInvitationDTO[]> {
  return unwrap(http.get('/api/project-invitations/pending'))
}

export function acceptProjectInvitation(invitationId: number): Promise<ProjectInvitationDTO> {
  return unwrap(http.post(`/api/project-invitations/${invitationId}/accept`))
}

export function rejectProjectInvitation(invitationId: number): Promise<ProjectInvitationDTO> {
  return unwrap(http.post(`/api/project-invitations/${invitationId}/reject`))
}

export function updateMemberRole(
  projectId: number,
  memberId: number,
  request: UpdateMemberRoleRequest
): Promise<ProjectMemberDTO> {
  return unwrap(http.patch(`/api/projects/${projectId}/members/${memberId}/role`, request))
}

export function removeProjectMember(projectId: number, memberId: number): Promise<boolean> {
  return unwrap(http.delete(`/api/projects/${projectId}/members/${memberId}`))
}
