package com.cloudcad.project.dto;

import com.cloudcad.project.entity.ProjectRole;

import java.time.Instant;

public record ProjectDTO(
    Long id,
    String name,
    String description,
    Long ownerId,
    ProjectRole myRole,
    Long defaultDocumentId,
    Instant createdAt,
    Instant updatedAt
) {
}
