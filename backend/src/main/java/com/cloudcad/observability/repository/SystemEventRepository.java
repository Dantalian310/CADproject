package com.cloudcad.observability.repository;

import com.cloudcad.observability.entity.SystemEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemEventRepository extends JpaRepository<SystemEventEntity, Long> {
}
