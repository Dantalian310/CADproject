package com.cloudcad.project.dto;

import com.cloudcad.project.entity.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record UpdateMemberRoleRequest(@NotNull ProjectRole role) {
}
