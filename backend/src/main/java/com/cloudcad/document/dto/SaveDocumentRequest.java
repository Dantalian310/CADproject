package com.cloudcad.document.dto;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record SaveDocumentRequest(@NotNull Integer baseVersion, @NotNull Map<String, Object> snapshotJson, String message) {
}
