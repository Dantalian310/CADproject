package com.cloudcad.document.controller;

import com.cloudcad.common.api.ApiResponse;
import com.cloudcad.document.dto.CreateDocumentRequest;
import com.cloudcad.document.dto.DocumentDTO;
import com.cloudcad.document.dto.SaveDocumentRequest;
import com.cloudcad.document.dto.UpdateDocumentRequest;
import com.cloudcad.document.service.DocumentService;
import com.cloudcad.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class DocumentController {
    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping("/api/projects/{projectId}/documents")
    public ApiResponse<List<DocumentDTO>> listDocuments(@PathVariable Long projectId, @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ApiResponse.ok(documentService.listByProject(projectId, currentUser.id()));
    }

    @PostMapping("/api/projects/{projectId}/documents")
    public ApiResponse<DocumentDTO> createDocument(
        @PathVariable Long projectId,
        @Valid @RequestBody CreateDocumentRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(documentService.createDocument(projectId, request.name(), request.description(), currentUser.id()));
    }

    @GetMapping("/api/documents/{documentId}")
    public ApiResponse<DocumentDTO> getDocument(@PathVariable Long documentId, @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ApiResponse.ok(documentService.getDocument(documentId, currentUser.id()));
    }

    @PutMapping("/api/documents/{documentId}/save")
    public ApiResponse<DocumentDTO> saveDocument(
        @PathVariable Long documentId,
        @Valid @RequestBody SaveDocumentRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(documentService.saveDocument(documentId, request.baseVersion(), request.snapshotJson(), request.message(), currentUser.id()));
    }

    @PutMapping("/api/documents/{documentId}")
    public ApiResponse<DocumentDTO> updateDocumentMetadata(
        @PathVariable Long documentId,
        @Valid @RequestBody UpdateDocumentRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return ApiResponse.ok(documentService.updateDocumentMetadata(documentId, request.name(), request.description(), currentUser.id()));
    }

    @GetMapping("/api/documents/{documentId}/export-json")
    public ResponseEntity<Map<String, Object>> exportJson(@PathVariable Long documentId, @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ResponseEntity.ok(documentService.getDocument(documentId, currentUser.id()).snapshotJson());
    }
}
