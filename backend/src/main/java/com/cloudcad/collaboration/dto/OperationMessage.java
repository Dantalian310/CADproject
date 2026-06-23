package com.cloudcad.collaboration.dto;

import java.time.Instant;
import java.util.Map;

public record OperationMessage(
    String operationId,
    Long documentId,
    String type,
    String targetId,
    Integer baseVersion,
    Map<String, Object> payload,
    Instant clientTimestamp
) {
}
