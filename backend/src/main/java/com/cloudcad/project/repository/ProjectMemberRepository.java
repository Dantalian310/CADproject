package com.cloudcad.project.repository;

import com.cloudcad.project.entity.ProjectMemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMemberEntity, Long> {
    List<ProjectMemberEntity> findByUserIdOrderByProjectUpdatedAtDesc(Long userId);

    List<ProjectMemberEntity> findByProjectIdOrderByCreatedAtAsc(Long projectId);

    Optional<ProjectMemberEntity> findByProjectIdAndUserId(Long projectId, Long userId);

    Optional<ProjectMemberEntity> findByIdAndProjectId(Long id, Long projectId);

    boolean existsByProjectIdAndUserId(Long projectId, Long userId);
}
