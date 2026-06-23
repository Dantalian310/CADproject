package com.cloudcad.project.dto;

import com.cloudcad.project.entity.ProjectInvitationStatus;
import com.cloudcad.project.entity.ProjectRole;
import com.cloudcad.user.dto.UserDTO;

import java.time.Instant;

public record ProjectInvitationDTO(
    Long id,
    Long projectId,
    String projectName,
    UserDTO inviter,
    UserDTO invitee,
    ProjectRole role,
    ProjectInvitationStatus status,
    Instant createdAt,
    Instant updatedAt,
    Instant respondedAt
) {
}
