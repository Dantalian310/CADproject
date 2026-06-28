package com.cloudcad.collaboration.service;

import com.cloudcad.collaboration.dto.OperationMessage;
import com.cloudcad.document.entity.DocumentEntity;
import com.cloudcad.document.service.DocumentService;
import com.cloudcad.observability.service.OperationLogService;
import com.cloudcad.project.service.ProjectPermissionService;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.service.UserService;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class CollaborationService {
    private final DocumentService documentService;
    private final ProjectPermissionService permissionService;
    private final UserService userService;
    private final OperationLogService operationLogService;
    private final ConflictService conflictService;
    private final CollaborationRevisionService revisionService;

    public CollaborationService(
        DocumentService documentService,
        ProjectPermissionService permissionService,
        UserService userService,
        OperationLogService operationLogService,
        ConflictService conflictService,
        CollaborationRevisionService revisionService
    ) {
        this.documentService = documentService;
        this.permissionService = permissionService;
        this.userService = userService;
        this.operationLogService = operationLogService;
        this.conflictService = conflictService;
        this.revisionService = revisionService;
    }

    public AcceptedOperation acceptOperation(Long documentId, OperationMessage message, Long userId) {
        DocumentEntity document = documentService.requireDocument(documentId);
        permissionService.requireEditor(document.getProject().getId(), userId);
        UserEntity user = userService.getById(userId);
        int serverVersion = document.getCurrentVersionNumber();
        CollaborationRevisionService.RevisionDecision revision = revisionService.accept(
            documentId,
            message.targetId(),
            userId,
            message.type(),
            message.clientRevision()
        );
        persistRealtimeSnapshot(documentId, message.payload(), userId);
        boolean conflict = conflictService.hasConflict(message, serverVersion)
            || revision.revisionConflict()
            || revision.targetConflict();
        String operationId = message.operationId() == null || message.operationId().isBlank()
            ? UUID.randomUUID().toString()
            : message.operationId();
        OperationMessage accepted = new OperationMessage(
            operationId,
            documentId,
            message.type(),
            message.targetId(),
            message.baseVersion(),
            message.clientId(),
            message.clientRevision(),
            revision.serverRevision(),
            userId,
            message.payload(),
            message.clientTimestamp()
        );
        operationLogService.record(
            operationId,
            document,
            user,
            message.type(),
            message.targetId(),
            message.baseVersion(),
            serverVersion,
            message.payload()
        );
        return new AcceptedOperation(accepted, conflict, serverVersion, revision);
    }

    @SuppressWarnings("unchecked")
    private void persistRealtimeSnapshot(Long documentId, Map<String, Object> payload, Long userId) {
        if (payload == null) return;
        Object snapshot = payload.get("documentSnapshot");
        if (snapshot instanceof Map<?, ?> snapshotMap) {
            documentService.updateLiveSnapshot(documentId, (Map<String, Object>) snapshotMap, userId);
        }
    }

    public record AcceptedOperation(
        OperationMessage operation,
        boolean conflict,
        int serverVersion,
        CollaborationRevisionService.RevisionDecision revision
    ) {}
}
