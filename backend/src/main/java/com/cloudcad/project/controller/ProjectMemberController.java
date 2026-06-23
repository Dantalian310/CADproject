package com.cloudcad.project.controller;

import com.cloudcad.common.api.ApiResponse;
import com.cloudcad.project.dto.AddProjectMemberRequest;
import com.cloudcad.project.dto.ProjectMemberDTO;
import com.cloudcad.project.dto.UpdateMemberRoleRequest;
import com.cloudcad.project.service.ProjectService;
import com.cloudcad.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/members")
public class ProjectMemberController {
    private final ProjectService projectService;

    public ProjectMemberController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public ApiResponse<List<ProjectMemberDTO>> listMembers(
        @PathVariable Long projectId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.listMembers(projectId, currentUser.id()));
    }

    @PostMapping
    public ApiResponse<ProjectMemberDTO> addMember(
        @PathVariable Long projectId,
        @Valid @RequestBody AddProjectMemberRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.addMember(projectId, request, currentUser.id()));
    }

    @PatchMapping("/{memberId}/role")
    public ApiResponse<ProjectMemberDTO> updateRole(
        @PathVariable Long projectId,
        @PathVariable Long memberId,
        @Valid @RequestBody UpdateMemberRoleRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.updateMemberRole(projectId, memberId, request, currentUser.id()));
    }

    @DeleteMapping("/{memberId}")
    public ApiResponse<Boolean> removeMember(
        @PathVariable Long projectId,
        @PathVariable Long memberId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.removeMember(projectId, memberId, currentUser.id()));
    }
}
