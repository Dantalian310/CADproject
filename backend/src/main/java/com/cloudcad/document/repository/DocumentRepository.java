package com.cloudcad.document.repository;

import com.cloudcad.document.entity.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {
    List<DocumentEntity> findByProjectIdAndDeletedFalseOrderByCreatedAtAsc(Long projectId);

    Optional<DocumentEntity> findByIdAndDeletedFalse(Long id);

    Optional<DocumentEntity> findFirstByProjectIdAndDeletedFalseOrderByIdAsc(Long projectId);
}
