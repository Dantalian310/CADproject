package com.cloudcad.version.dto;

import com.cloudcad.user.dto.UserDTO;
import java.time.Instant;
import java.util.Map;

public record VersionDetailDTO(
    Long id,
    Long documentId,
    Integer versionNumber,
    Map<String, Object> snapshotJson,
    UserDTO createdBy,
    String message,
    Instant createdAt
) {
}
