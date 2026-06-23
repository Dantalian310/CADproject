package com.cloudcad.observability.service;

import com.cloudcad.document.entity.DocumentEntity;
import com.cloudcad.observability.entity.SystemEventEntity;
import com.cloudcad.observability.repository.SystemEventRepository;
import com.cloudcad.project.entity.ProjectEntity;
import com.cloudcad.user.entity.UserEntity;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class SystemEventService {
    private final SystemEventRepository systemEventRepository;

    public SystemEventService(SystemEventRepository systemEventRepository) {
        this.systemEventRepository = systemEventRepository;
    }

    public void record(
        String eventType,
        String result,
        UserEntity user,
        ProjectEntity project,
        DocumentEntity document,
        Map<String, Object> payload
    ) {
        SystemEventEntity event = new SystemEventEntity();
        event.setTraceId(UUID.randomUUID().toString());
        event.setEventType(eventType);
        event.setResult(result);
        event.setUser(user);
        event.setProject(project);
        event.setDocument(document);
        event.setEventPayload(payload);
        systemEventRepository.save(event);
    }
}
