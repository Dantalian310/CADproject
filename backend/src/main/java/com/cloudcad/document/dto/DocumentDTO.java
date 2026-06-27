package com.cloudcad.document.dto;

import java.time.Instant;
import java.util.Map;

public record DocumentDTO(
    Long id,
    Long projectId,
    String name,
    String description,
    Integer currentVersion,
    Map<String, Object> snapshotJson,
    Instant createdAt,
    Instant updatedAt
) {
}
