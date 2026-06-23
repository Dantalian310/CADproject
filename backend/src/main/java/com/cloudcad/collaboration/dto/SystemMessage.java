package com.cloudcad.collaboration.dto;

import java.time.Instant;
import java.util.Map;

public record SystemMessage(String type, Long documentId, Instant serverTimestamp, Map<String, Object> payload) {
}
