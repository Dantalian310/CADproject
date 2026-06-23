package com.cloudcad.version.service;

import com.cloudcad.common.exception.BusinessException;
import com.cloudcad.common.exception.ErrorCode;
import com.cloudcad.document.dto.DocumentDTO;
import com.cloudcad.document.entity.DocumentEntity;
import com.cloudcad.document.service.DocumentService;
import com.cloudcad.project.service.ProjectPermissionService;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.service.UserService;
import com.cloudcad.version.dto.VersionDTO;
import com.cloudcad.version.dto.VersionDetailDTO;
import com.cloudcad.version.entity.DocumentVersionEntity;
import com.cloudcad.version.repository.DocumentVersionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class VersionService {
    private final DocumentService documentService;
    private final DocumentVersionRepository versionRepository;
    private final ProjectPermissionService permissionService;
    private final UserService userService;

    public VersionService(
        DocumentService documentService,
        DocumentVersionRepository versionRepository,
        ProjectPermissionService permissionService,
        UserService userService
    ) {
        this.documentService = documentService;
        this.versionRepository = versionRepository;
        this.permissionService = permissionService;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public List<VersionDTO> listVersions(Long documentId, Long userId) {
        DocumentEntity document = documentService.requireDocument(documentId);
        permissionService.requireMember(document.getProject().getId(), userId);
        return versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId).stream()
            .map(this::toDTO)
            .toList();
    }

    @Transactional(readOnly = true)
    public VersionDetailDTO getVersion(Long documentId, Long versionId, Long userId) {
        DocumentEntity document = documentService.requireDocument(documentId);
        permissionService.requireMember(document.getProject().getId(), userId);
        return toDetailDTO(requireVersion(documentId, versionId));
    }

    @Transactional
    public DocumentDTO restore(Long documentId, Long versionId, String message, Long userId) {
        DocumentEntity document = documentService.requireDocument(documentId);
        permissionService.requireEditor(document.getProject().getId(), userId);
        DocumentVersionEntity targetVersion = requireVersion(documentId, versionId);
        int nextVersion = document.getCurrentVersionNumber() + 1;
        UserEntity user = userService.getById(userId);
        Map<String, Object> snapshot = targetVersion.getSnapshotJson();
        DocumentVersionEntity restoredVersion = new DocumentVersionEntity();
        restoredVersion.setDocument(document);
        restoredVersion.setVersionNumber(nextVersion);
        restoredVersion.setSnapshotJson(snapshot);
        restoredVersion.setCreatedBy(user);
        restoredVersion.setMessage(message == null || message.isBlank() ? "恢复到版本 " + targetVersion.getVersionNumber() : message);
        DocumentVersionEntity savedVersion = versionRepository.save(restoredVersion);

        document.setSnapshotJson(snapshot);
        document.setCurrentVersion(savedVersion);
        document.setCurrentVersionNumber(nextVersion);
        document.setUpdatedBy(user);
        document.setUpdatedAt(Instant.now());
        return documentService.toDTO(document);
    }

    private DocumentVersionEntity requireVersion(Long documentId, Long versionId) {
        return versionRepository.findByIdAndDocumentId(versionId, documentId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "版本不存在"));
    }

    private VersionDTO toDTO(DocumentVersionEntity version) {
        return new VersionDTO(
            version.getId(),
            version.getDocument().getId(),
            version.getVersionNumber(),
            userService.toDTO(version.getCreatedBy()),
            version.getMessage(),
            version.getCreatedAt()
        );
    }

    private VersionDetailDTO toDetailDTO(DocumentVersionEntity version) {
        return new VersionDetailDTO(
            version.getId(),
            version.getDocument().getId(),
            version.getVersionNumber(),
            version.getSnapshotJson(),
            userService.toDTO(version.getCreatedBy()),
            version.getMessage(),
            version.getCreatedAt()
        );
    }
}
