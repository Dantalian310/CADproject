package com.cloudcad.version.repository;

import com.cloudcad.version.entity.DocumentVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersionEntity, Long> {
    List<DocumentVersionEntity> findByDocumentIdOrderByVersionNumberDesc(Long documentId);

    Optional<DocumentVersionEntity> findByIdAndDocumentId(Long id, Long documentId);
}
