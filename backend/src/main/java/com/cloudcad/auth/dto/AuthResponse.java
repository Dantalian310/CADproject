package com.cloudcad.auth.dto;

import com.cloudcad.user.dto.UserDTO;

public record AuthResponse(String token, UserDTO user) {
}
