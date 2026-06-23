package com.cloudcad.observability.repository;

import com.cloudcad.observability.entity.OperationLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationLogRepository extends JpaRepository<OperationLogEntity, Long> {
}
