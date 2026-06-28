package com.cloudcad.collaboration.service;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class CollaborationRevisionService {
    private static final Duration TARGET_CONFLICT_WINDOW = Duration.ofSeconds(15);

    private final ConcurrentMap<Long, AtomicLong> documentRevisions = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, ConcurrentMap<String, TargetEdit>> targetEdits = new ConcurrentHashMap<>();

    public RevisionDecision accept(Long documentId, String targetId, Long userId, String operationType, Long clientRevision) {
        AtomicLong revision = documentRevisions.computeIfAbsent(documentId, ignored -> new AtomicLong(0));
        long currentRevision = revision.get();
        boolean revisionConflict = clientRevision != null && clientRevision < currentRevision;
        TargetEdit conflictingEdit = findRecentConflictingEdit(documentId, targetId, userId, clientRevision);
        long nextRevision = revision.incrementAndGet();
        recordTargetEdit(documentId, targetId, userId, operationType, nextRevision);
        return new RevisionDecision(nextRevision, revisionConflict, conflictingEdit != null, conflictingEdit);
    }

    private TargetEdit findRecentConflictingEdit(Long documentId, String targetId, Long userId, Long clientRevision) {
        if (targetId == null || targetId.isBlank() || "document".equals(targetId) || clientRevision == null) {
            return null;
        }
        ConcurrentMap<String, TargetEdit> edits = targetEdits.get(documentId);
        if (edits == null) return null;
        TargetEdit edit = edits.get(targetId);
        if (edit == null || edit.userId().equals(userId)) return null;
        boolean editedAfterClientRevision = clientRevision < edit.revision();
        boolean stillRecent = Duration.between(edit.editedAt(), Instant.now()).compareTo(TARGET_CONFLICT_WINDOW) <= 0;
        return editedAfterClientRevision && stillRecent ? edit : null;
    }

    private void recordTargetEdit(Long documentId, String targetId, Long userId, String operationType, long revision) {
        if (targetId == null || targetId.isBlank() || "document".equals(targetId)) {
            return;
        }
        targetEdits
            .computeIfAbsent(documentId, ignored -> new ConcurrentHashMap<>())
            .put(targetId, new TargetEdit(userId, operationType, revision, Instant.now()));
    }

    public record RevisionDecision(
        long serverRevision,
        boolean revisionConflict,
        boolean targetConflict,
        TargetEdit conflictingEdit
    ) {}

    public record TargetEdit(Long userId, String operationType, long revision, Instant editedAt) {}
}
