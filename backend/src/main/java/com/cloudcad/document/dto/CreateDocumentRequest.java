package com.cloudcad.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDocumentRequest(@NotBlank @Size(max = 128) String name) {
}
