package com.cloudcad.collaboration.service;

import com.cloudcad.collaboration.dto.PresenceMessage;
import com.cloudcad.document.entity.DocumentEntity;
import com.cloudcad.document.service.DocumentService;
import com.cloudcad.project.entity.ProjectMemberEntity;
import com.cloudcad.project.service.ProjectPermissionService;
import com.cloudcad.security.AuthenticatedUser;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.service.UserService;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {
    private final Map<Long, Map<String, PresenceMessage.OnlineUserDTO>> rooms = new ConcurrentHashMap<>();
    private final DocumentService documentService;
    private final ProjectPermissionService permissionService;
    private final UserService userService;

    public PresenceService(
        DocumentService documentService,
        ProjectPermissionService permissionService,
        UserService userService
    ) {
        this.documentService = documentService;
        this.permissionService = permissionService;
        this.userService = userService;
    }

    public PresenceMessage join(Long documentId, String sessionId, AuthenticatedUser currentUser) {
        DocumentEntity document = documentService.requireDocument(documentId);
        ProjectMemberEntity member = permissionService.requireMember(document.getProject().getId(), currentUser.id());
        UserEntity user = userService.getById(currentUser.id());
        Map<String, PresenceMessage.OnlineUserDTO> room = rooms.computeIfAbsent(documentId, ignored -> new ConcurrentHashMap<>());
        room.entrySet().removeIf(entry -> entry.getValue().id().equals(user.getId()));
        room.put(sessionId, new PresenceMessage.OnlineUserDTO(
            user.getId(),
            user.getUsername(),
            user.getDisplayName(),
            member.getRole().name(),
            colorForUser(user.getId())
        ));
        return currentUsers(documentId);
    }

    public PresenceMessage leave(Long documentId, String sessionId) {
        Map<String, PresenceMessage.OnlineUserDTO> room = rooms.get(documentId);
        if (room != null) {
            room.remove(sessionId);
            if (room.isEmpty()) {
                rooms.remove(documentId);
            }
        }
        return currentUsers(documentId);
    }

    public Map<Long, PresenceMessage> leaveSession(String sessionId) {
        Map<Long, PresenceMessage> updates = new HashMap<>();
        rooms.forEach((documentId, room) -> {
            if (room.remove(sessionId) != null) {
                if (room.isEmpty()) {
                    rooms.remove(documentId);
                }
                updates.put(documentId, currentUsers(documentId));
            }
        });
        return updates;
    }

    public PresenceMessage currentUsers(Long documentId) {
        Map<String, PresenceMessage.OnlineUserDTO> room = rooms.getOrDefault(documentId, Map.of());
        Map<Long, PresenceMessage.OnlineUserDTO> uniqueUsers = new LinkedHashMap<>();
        for (PresenceMessage.OnlineUserDTO user : room.values()) {
            uniqueUsers.put(user.id(), user);
        }
        return new PresenceMessage(List.copyOf(uniqueUsers.values()));
    }

    public boolean hasOtherOnlineUsers(Long documentId, Long currentUserId) {
        Map<String, PresenceMessage.OnlineUserDTO> room = rooms.getOrDefault(documentId, Map.of());
        return room.values().stream().anyMatch(user -> !user.id().equals(currentUserId));
    }

    private String colorForUser(Long userId) {
        List<String> colors = List.of("#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2");
        return colors.get(Math.floorMod(userId.hashCode(), colors.size()));
    }
}
