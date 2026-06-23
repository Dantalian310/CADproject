package com.cloudcad.project.dto;

import com.cloudcad.project.entity.ProjectRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateProjectInvitationRequest(@NotBlank String account, @NotNull ProjectRole role) {
}
