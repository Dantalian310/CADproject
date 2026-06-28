package com.cloudcad.collaboration.dto;

import java.time.Instant;
import java.util.Map;

public record OperationMessage(
    String operationId,
    Long documentId,
    String type,
    String targetId,
    Integer baseVersion,
    String clientId,
    Long clientRevision,
    Long serverRevision,
    Long authorUserId,
    Map<String, Object> payload,
    Instant clientTimestamp
) {
}
