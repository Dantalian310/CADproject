package com.cloudcad.collaboration.dto;

import java.time.Instant;

public record CursorMessage(String userId, String username, Double x, Double y, String color, Instant updatedAt) {
}
