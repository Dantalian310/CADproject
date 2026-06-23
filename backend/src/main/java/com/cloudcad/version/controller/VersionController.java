package com.cloudcad.version.controller;

import com.cloudcad.common.api.ApiResponse;
import com.cloudcad.document.dto.DocumentDTO;
import com.cloudcad.security.AuthenticatedUser;
import com.cloudcad.version.dto.RestoreVersionRequest;
import com.cloudcad.version.dto.VersionDTO;
import com.cloudcad.version.dto.VersionDetailDTO;
import com.cloudcad.version.service.VersionService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/documents/{documentId}/versions")
public class VersionController {
    private final VersionService versionService;

    public VersionController(VersionService versionService) {
        this.versionService = versionService;
    }

    @GetMapping
    public ApiResponse<List<VersionDTO>> listVersions(@PathVariable Long documentId, @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ApiResponse.ok(versionService.listVersions(documentId, currentUser.id()));
    }

    @GetMapping("/{versionId}")
    public ApiResponse<VersionDetailDTO> getVersion(
        @PathVariable Long documentId,
        @PathVariable Long versionId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(versionService.getVersion(documentId, versionId, currentUser.id()));
    }

    @PostMapping("/{versionId}/restore")
    public ApiResponse<DocumentDTO> restore(
        @PathVariable Long documentId,
        @PathVariable Long versionId,
        @RequestBody(required = false) RestoreVersionRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        String message = request == null ? null : request.message();
        return ApiResponse.ok(versionService.restore(documentId, versionId, message, currentUser.id()));
    }
}
