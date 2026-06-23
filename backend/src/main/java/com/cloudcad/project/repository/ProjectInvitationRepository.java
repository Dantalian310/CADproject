package com.cloudcad.project.repository;

import com.cloudcad.project.entity.ProjectInvitationEntity;
import com.cloudcad.project.entity.ProjectInvitationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectInvitationRepository extends JpaRepository<ProjectInvitationEntity, Long> {
    List<ProjectInvitationEntity> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    List<ProjectInvitationEntity> findByInviteeIdAndStatusOrderByCreatedAtDesc(
        Long inviteeId,
        ProjectInvitationStatus status
    );

    Optional<ProjectInvitationEntity> findByProjectIdAndInviteeIdAndStatus(
        Long projectId,
        Long inviteeId,
        ProjectInvitationStatus status
    );

    Optional<ProjectInvitationEntity> findByIdAndProjectId(Long id, Long projectId);
}
