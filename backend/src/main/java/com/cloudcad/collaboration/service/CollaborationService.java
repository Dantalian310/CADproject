package com.cloudcad.collaboration.service;

import com.cloudcad.collaboration.dto.OperationMessage;
import com.cloudcad.document.entity.DocumentEntity;
import com.cloudcad.document.service.DocumentService;
import com.cloudcad.observability.service.OperationLogService;
import com.cloudcad.project.service.ProjectPermissionService;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.service.UserService;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CollaborationService {
    private final DocumentService documentService;
    private final ProjectPermissionService permissionService;
    private final UserService userService;
    private final OperationLogService operationLogService;
    private final ConflictService conflictService;

    public CollaborationService(
        DocumentService documentService,
        ProjectPermissionService permissionService,
        UserService userService,
        OperationLogService operationLogService,
        ConflictService conflictService
    ) {
        this.documentService = documentService;
        this.permissionService = permissionService;
        this.userService = userService;
        this.operationLogService = operationLogService;
        this.conflictService = conflictService;
    }

    public AcceptedOperation acceptOperation(Long documentId, OperationMessage message, Long userId) {
        DocumentEntity document = documentService.requireDocument(documentId);
        permissionService.requireEditor(document.getProject().getId(), userId);
        UserEntity user = userService.getById(userId);
        int serverVersion = document.getCurrentVersionNumber();
        boolean conflict = conflictService.hasConflict(message, serverVersion);
        String operationId = message.operationId() == null || message.operationId().isBlank()
            ? UUID.randomUUID().toString()
            : message.operationId();
        OperationMessage accepted = new OperationMessage(
            operationId,
            documentId,
            message.type(),
            message.targetId(),
            message.baseVersion(),
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
        return new AcceptedOperation(accepted, conflict, serverVersion);
    }

    public record AcceptedOperation(OperationMessage operation, boolean conflict, int serverVersion) {}
}
