package com.cloudcad.collaboration.dto;

import java.util.List;

public record PresenceMessage(List<OnlineUserDTO> onlineUsers) {
    public record OnlineUserDTO(Long id, String username, String displayName, String role, String color) {
    }
}
