package com.cloudcad.collaboration.controller;

import com.cloudcad.collaboration.dto.CursorMessage;
import com.cloudcad.collaboration.dto.OperationMessage;
import com.cloudcad.collaboration.service.CollaborationService;
import com.cloudcad.collaboration.service.PresenceService;
import com.cloudcad.security.AuthenticatedUser;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;

@Controller
public class CollaborationMessageController {
    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final CollaborationService collaborationService;

    public CollaborationMessageController(
        SimpMessagingTemplate messagingTemplate,
        PresenceService presenceService,
        CollaborationService collaborationService
    ) {
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.collaborationService = collaborationService;
    }

    @MessageMapping("/documents/{documentId}/join")
    public void join(@DestinationVariable Long documentId, @Header("simpSessionId") String sessionId, Principal principal) {
        AuthenticatedUser user = requireUser(principal);
        messagingTemplate.convertAndSend(
            "/topic/documents/" + documentId + "/presence",
            envelope("presence.update", presenceService.join(documentId, sessionId, user))
        );
    }

    @MessageMapping("/documents/{documentId}/leave")
    public void leave(@DestinationVariable Long documentId, @Header("simpSessionId") String sessionId) {
        messagingTemplate.convertAndSend(
            "/topic/documents/" + documentId + "/presence",
            envelope("presence.update", presenceService.leave(documentId, sessionId))
        );
    }

    @MessageMapping("/documents/{documentId}/cursor")
    public void cursor(@DestinationVariable Long documentId, CursorMessage message, Principal principal) {
        AuthenticatedUser user = requireUser(principal);
        CursorMessage cursor = new CursorMessage(
            String.valueOf(user.id()),
            user.username(),
            message.x(),
            message.y(),
            "#2563eb",
            Instant.now()
        );
        messagingTemplate.convertAndSend("/topic/documents/" + documentId + "/cursor", envelope("cursor.update", cursor));
    }

    @MessageMapping("/documents/{documentId}/operations")
    public void operation(@DestinationVariable Long documentId, OperationMessage message, Principal principal) {
        AuthenticatedUser user = requireUser(principal);
        CollaborationService.AcceptedOperation accepted = collaborationService.acceptOperation(documentId, message, user.id());
        if (accepted.conflict()) {
            messagingTemplate.convertAndSend(
                "/topic/documents/" + documentId + "/system",
                envelope("conflict.warning", Map.of(
                    "reason", "当前操作基于旧版本，可能与其他成员的修改产生冲突",
                    "serverVersion", accepted.serverVersion()
                ))
            );
        }
        messagingTemplate.convertAndSend(
            "/topic/documents/" + documentId + "/operations",
            envelope("operation.applied", accepted.operation())
        );
    }

    private AuthenticatedUser requireUser(Principal principal) {
        if (principal instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser;
        }
        throw new IllegalStateException("WebSocket user is not authenticated");
    }

    private Map<String, Object> envelope(String type, Object payload) {
        return Map.of(
            "type", type,
            "payload", payload,
            "serverTimestamp", Instant.now()
        );
    }
}
