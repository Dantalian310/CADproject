package com.cloudcad.observability.service;

import com.cloudcad.document.entity.DocumentEntity;
import com.cloudcad.observability.entity.OperationLogEntity;
import com.cloudcad.observability.repository.OperationLogRepository;
import com.cloudcad.user.entity.UserEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class OperationLogService {
    private final OperationLogRepository operationLogRepository;

    public OperationLogService(OperationLogRepository operationLogRepository) {
        this.operationLogRepository = operationLogRepository;
    }

    public void record(
        String operationId,
        DocumentEntity document,
        UserEntity user,
        String operationType,
        String targetId,
        Integer baseVersion,
        Integer serverVersion,
        Map<String, Object> payload
    ) {
        OperationLogEntity log = new OperationLogEntity();
        log.setOperationId(operationId);
        log.setDocument(document);
        log.setUser(user);
        log.setOperationType(operationType);
        log.setTargetId(targetId);
        log.setBaseVersion(baseVersion);
        log.setServerVersion(serverVersion);
        log.setOperationPayload(payload == null ? Map.of() : payload);
        operationLogRepository.save(log);
    }
}
