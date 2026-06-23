package com.cloudcad.document.service;

import com.cloudcad.common.exception.BusinessException;
import com.cloudcad.common.exception.ErrorCode;
import com.cloudcad.document.dto.DocumentDTO;
import com.cloudcad.document.entity.DocumentEntity;
import com.cloudcad.document.repository.DocumentRepository;
import com.cloudcad.project.entity.ProjectEntity;
import com.cloudcad.project.repository.ProjectRepository;
import com.cloudcad.project.service.ProjectPermissionService;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.service.UserService;
import com.cloudcad.version.entity.DocumentVersionEntity;
import com.cloudcad.version.repository.DocumentVersionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class DocumentService {
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final ProjectRepository projectRepository;
    private final ProjectPermissionService permissionService;
    private final UserService userService;

    public DocumentService(
        DocumentRepository documentRepository,
        DocumentVersionRepository versionRepository,
        ProjectRepository projectRepository,
        ProjectPermissionService permissionService,
        UserService userService
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.projectRepository = projectRepository;
        this.permissionService = permissionService;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public List<DocumentDTO> listByProject(Long projectId, Long userId) {
        permissionService.requireMember(projectId, userId);
        return documentRepository.findByProjectIdAndDeletedFalseOrderByCreatedAtAsc(projectId).stream()
            .map(this::toDTO)
            .toList();
    }

    @Transactional(readOnly = true)
    public DocumentDTO getDocument(Long documentId, Long userId) {
        DocumentEntity document = requireDocument(documentId);
        permissionService.requireMember(document.getProject().getId(), userId);
        return toDTO(document);
    }

    @Transactional
    public DocumentDTO createDocument(Long projectId, String name, Long userId) {
        permissionService.requireEditor(projectId, userId);
        UserEntity user = userService.getById(userId);
        ProjectEntity project = requireProject(projectId);
        return toDTO(createDocumentEntity(project, name, user));
    }

    @Transactional
    public DocumentDTO createDefaultDocument(ProjectEntity project, UserEntity user) {
        return toDTO(createDocumentEntity(project, "Demo Part", user));
    }

    @Transactional
    public DocumentDTO saveDocument(Long documentId, Integer baseVersion, Map<String, Object> snapshotJson, String message, Long userId) {
        DocumentEntity document = requireDocument(documentId);
        permissionService.requireEditor(document.getProject().getId(), userId);
        if (!document.getCurrentVersionNumber().equals(baseVersion)) {
            throw new BusinessException(ErrorCode.DOCUMENT_VERSION_CONFLICT, "文档版本已更新，请刷新后再保存");
        }
        validateSnapshot(snapshotJson);
        int nextVersion = document.getCurrentVersionNumber() + 1;
        UserEntity user = userService.getById(userId);
        DocumentVersionEntity version = createVersion(document, nextVersion, snapshotJson, user, message);
        document.setSnapshotJson(snapshotJson);
        document.setCurrentVersionNumber(nextVersion);
        document.setCurrentVersion(version);
        document.setUpdatedBy(user);
        document.setUpdatedAt(Instant.now());
        return toDTO(documentRepository.save(document));
    }

    public DocumentEntity requireDocument(Long documentId) {
        return documentRepository.findByIdAndDeletedFalse(documentId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "CAD 文档不存在"));
    }

    public DocumentDTO toDTO(DocumentEntity document) {
        return new DocumentDTO(
            document.getId(),
            document.getProject().getId(),
            document.getName(),
            document.getCurrentVersionNumber(),
            document.getSnapshotJson(),
            document.getCreatedAt(),
            document.getUpdatedAt()
        );
    }

    private ProjectEntity requireProject(Long projectId) {
        return projectRepository.findById(projectId)
            .filter(project -> !Boolean.TRUE.equals(project.getDeleted()))
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "项目不存在"));
    }

    private DocumentEntity createDocumentEntity(ProjectEntity project, String name, UserEntity user) {
        DocumentEntity document = new DocumentEntity();
        document.setProject(project);
        document.setName(name);
        document.setCreatedBy(user);
        document.setUpdatedBy(user);
        document.setCurrentVersionNumber(0);
        document.setSnapshotJson(emptySnapshot("pending", name, 0));
        DocumentEntity savedDocument = documentRepository.save(document);
        Map<String, Object> initialSnapshot = emptySnapshot(String.valueOf(savedDocument.getId()), name, 1);
        DocumentVersionEntity version = createVersion(savedDocument, 1, initialSnapshot, user, "初始版本");
        savedDocument.setSnapshotJson(initialSnapshot);
        savedDocument.setCurrentVersion(version);
        savedDocument.setCurrentVersionNumber(1);
        savedDocument.setUpdatedAt(Instant.now());
        return documentRepository.save(savedDocument);
    }

    private DocumentVersionEntity createVersion(
        DocumentEntity document,
        int versionNumber,
        Map<String, Object> snapshotJson,
        UserEntity user,
        String message
    ) {
        DocumentVersionEntity version = new DocumentVersionEntity();
        version.setDocument(document);
        version.setVersionNumber(versionNumber);
        version.setSnapshotJson(snapshotJson);
        version.setCreatedBy(user);
        version.setMessage(message == null || message.isBlank() ? "保存版本 " + versionNumber : message);
        return versionRepository.save(version);
    }

    private void validateSnapshot(Map<String, Object> snapshotJson) {
        if (snapshotJson == null || !snapshotJson.containsKey("schemaVersion") || !snapshotJson.containsKey("features")) {
            throw new BusinessException(ErrorCode.INVALID_CAD_SNAPSHOT, "CAD 快照结构不完整");
        }
    }

    public Map<String, Object> emptySnapshot(String documentId, String name) {
        return emptySnapshot(documentId, name, 0);
    }

    public Map<String, Object> emptySnapshot(String documentId, String name, int currentVersion) {
        return Map.of(
            "schemaVersion", "1.0",
            "documentId", documentId,
            "name", name,
            "unit", "mm",
            "metadata", Map.of("currentVersion", currentVersion),
            "sketches", List.of(Map.of(
                "id", "sketch-001",
                "name", "Sketch 1",
                "plane", "XY",
                "entities", List.of(),
                "constraints", List.of()
            )),
            "features", List.of()
        );
    }
}
