import { defineStore } from 'pinia'
import {
  acceptProjectInvitation,
  addProjectMember,
  cancelProjectInvitation,
  createProjectInvitation,
  createProject,
  deleteProject as deleteProjectApi,
  getProject,
  listMyPendingInvitations,
  listProjectInvitations,
  listProjectMembers,
  rejectProjectInvitation,
  listProjects,
  removeProjectMember,
  updateProject,
  updateMemberRole
} from '@/api/project.api'
import type {
  AddProjectMemberRequest,
  CreateProjectInvitationRequest,
  CreateProjectRequest,
  ProjectDTO,
  ProjectInvitationDTO,
  ProjectMemberDTO,
  UpdateMemberRoleRequest
} from '@/api/types'

interface ProjectState {
  projects: ProjectDTO[]
  currentProject: ProjectDTO | null
  members: ProjectMemberDTO[]
  invitations: ProjectInvitationDTO[]
  pendingInvitations: ProjectInvitationDTO[]
  loading: boolean
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    projects: [],
    currentProject: null,
    members: [],
    invitations: [],
    pendingInvitations: [],
    loading: false
  }),
  actions: {
    async loadProjects() {
      this.loading = true
      try {
        this.projects = await listProjects()
      } finally {
        this.loading = false
      }
    },
    async createProject(request: CreateProjectRequest) {
      const project = await createProject(request)
      this.projects.unshift(project)
      return project
    },
    async updateProject(projectId: number, request: CreateProjectRequest) {
      const project = await updateProject(projectId, request)
      this.projects = this.projects.map((item) => (item.id === project.id ? project : item))
      if (this.currentProject?.id === project.id) {
        this.currentProject = project
      }
      return project
    },
    async deleteProject(projectId: number) {
      await deleteProjectApi(projectId)
      this.projects = this.projects.filter((project) => project.id !== projectId)
      if (this.currentProject?.id === projectId) {
        this.currentProject = null
      }
    },
    async loadProject(projectId: number) {
      this.currentProject = await getProject(projectId)
      return this.currentProject
    },
    async loadMembers(projectId: number) {
      this.members = await listProjectMembers(projectId)
    },
    async addMember(projectId: number, request: AddProjectMemberRequest) {
      const member = await addProjectMember(projectId, request)
      this.members.push(member)
    },
    async loadProjectInvitations(projectId: number) {
      this.invitations = await listProjectInvitations(projectId)
    },
    async inviteMember(projectId: number, request: CreateProjectInvitationRequest) {
      const invitation = await createProjectInvitation(projectId, request)
      this.invitations.unshift(invitation)
      return invitation
    },
    async cancelInvitation(projectId: number, invitationId: number) {
      const invitation = await cancelProjectInvitation(projectId, invitationId)
      this.invitations = this.invitations.map((item) => (item.id === invitation.id ? invitation : item))
      return invitation
    },
    async loadPendingInvitations() {
      this.pendingInvitations = await listMyPendingInvitations()
    },
    async acceptInvitation(invitationId: number) {
      const invitation = await acceptProjectInvitation(invitationId)
      this.pendingInvitations = this.pendingInvitations.filter((item) => item.id !== invitation.id)
      await this.loadProjects()
      return invitation
    },
    async rejectInvitation(invitationId: number) {
      const invitation = await rejectProjectInvitation(invitationId)
      this.pendingInvitations = this.pendingInvitations.filter((item) => item.id !== invitation.id)
      return invitation
    },
    async updateMemberRole(projectId: number, memberId: number, request: UpdateMemberRoleRequest) {
      const member = await updateMemberRole(projectId, memberId, request)
      this.members = this.members.map((item) => (item.id === member.id ? member : item))
    },
    async removeMember(projectId: number, memberId: number) {
      await removeProjectMember(projectId, memberId)
      this.members = this.members.filter((item) => item.id !== memberId)
    }
  }
})
