package com.cloudcad.project.controller;

import com.cloudcad.common.api.ApiResponse;
import com.cloudcad.project.dto.CreateProjectRequest;
import com.cloudcad.project.dto.ProjectDTO;
import com.cloudcad.project.service.ProjectService;
import com.cloudcad.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public ApiResponse<List<ProjectDTO>> listProjects(@AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ApiResponse.ok(projectService.listMyProjects(currentUser.id()));
    }

    @PostMapping
    public ApiResponse<ProjectDTO> createProject(
        @Valid @RequestBody CreateProjectRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.createProject(request, currentUser.id()));
    }

    @GetMapping("/{projectId}")
    public ApiResponse<ProjectDTO> getProject(@PathVariable Long projectId, @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ApiResponse.ok(projectService.getProject(projectId, currentUser.id()));
    }

    @PatchMapping("/{projectId}")
    public ApiResponse<ProjectDTO> updateProject(
        @PathVariable Long projectId,
        @Valid @RequestBody CreateProjectRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(projectService.updateProject(projectId, request, currentUser.id()));
    }

    @DeleteMapping("/{projectId}")
    public ApiResponse<Boolean> deleteProject(@PathVariable Long projectId, @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ApiResponse.ok(projectService.deleteProject(projectId, currentUser.id()));
    }
}
