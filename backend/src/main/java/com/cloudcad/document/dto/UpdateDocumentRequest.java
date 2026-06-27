package com.cloudcad.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDocumentRequest(
    @NotBlank @Size(max = 128) String name,
    @Size(max = 1000) String description
) {
}
