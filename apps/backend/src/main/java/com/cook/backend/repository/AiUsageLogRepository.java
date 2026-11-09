package com.cook.backend.repository;

import com.cook.backend.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, Long> {
    List<AiUsageLog> findByDeviceHash(String deviceHash);
}
