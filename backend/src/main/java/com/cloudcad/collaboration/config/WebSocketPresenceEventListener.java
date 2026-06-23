package com.cloudcad.collaboration.config;

import com.cloudcad.collaboration.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.util.Map;

@Component
public class WebSocketPresenceEventListener {
    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketPresenceEventListener(PresenceService presenceService, SimpMessagingTemplate messagingTemplate) {
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        presenceService.leaveSession(event.getSessionId()).forEach((documentId, presence) ->
            messagingTemplate.convertAndSend(
                "/topic/documents/" + documentId + "/presence",
                Map.of(
                    "type", "presence.update",
                    "payload", presence,
                    "serverTimestamp", Instant.now()
                )
            )
        );
    }
}
