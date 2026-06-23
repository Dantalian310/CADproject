package com.cloudcad.project.controller;

import com.cloudcad.common.api.ApiResponse;
import com.cloudcad.project.dto.CreateProjectInvitationRequest;
import com.cloudcad.project.dto.ProjectInvitationDTO;
import com.cloudcad.project.service.ProjectService;
import com.cloudcad.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ProjectInvitationController {
    private final ProjectService projectService;

    public ProjectInvitationController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping("/api/projects/{projectId}/invitations")
    public ApiResponse<List<ProjectInvitationDTO>> listProjectInvitations(
        @PathVariable Long projectId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.listProjectInvitations(projectId, currentUser.id()));
    }

    @PostMapping("/api/projects/{projectId}/invitations")
    public ApiResponse<ProjectInvitationDTO> inviteMember(
        @PathVariable Long projectId,
        @Valid @RequestBody CreateProjectInvitationRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.inviteMember(projectId, request, currentUser.id()));
    }

    @DeleteMapping("/api/projects/{projectId}/invitations/{invitationId}")
    public ApiResponse<ProjectInvitationDTO> cancelInvitation(
        @PathVariable Long projectId,
        @PathVariable Long invitationId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.cancelInvitation(projectId, invitationId, currentUser.id()));
    }

    @GetMapping("/api/project-invitations/pending")
    public ApiResponse<List<ProjectInvitationDTO>> listMyPendingInvitations(
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.listMyPendingInvitations(currentUser.id()));
    }

    @PostMapping("/api/project-invitations/{invitationId}/accept")
    public ApiResponse<ProjectInvitationDTO> acceptInvitation(
        @PathVariable Long invitationId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.acceptInvitation(invitationId, currentUser.id()));
    }

    @PostMapping("/api/project-invitations/{invitationId}/reject")
    public ApiResponse<ProjectInvitationDTO> rejectInvitation(
        @PathVariable Long invitationId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.rejectInvitation(invitationId, currentUser.id()));
    }
}
