package com.cloudcad.version.dto;

import com.cloudcad.user.dto.UserDTO;
import java.time.Instant;

public record VersionDTO(Long id, Long documentId, Integer versionNumber, UserDTO createdBy, String message, Instant createdAt) {
}
