package com.cloudcad.project.dto;

import com.cloudcad.project.entity.ProjectRole;
import com.cloudcad.user.dto.UserDTO;

import java.time.Instant;

public record ProjectMemberDTO(Long id, Long projectId, UserDTO user, ProjectRole role, Instant createdAt) {
}
