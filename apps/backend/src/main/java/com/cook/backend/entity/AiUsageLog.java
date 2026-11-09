package com.cook.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "ai_usage_log")
public class AiUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_hash", nullable = false, length = 64)
    private String deviceHash;

    @Column(name = "endpoint", nullable = false, length = 64)
    private String endpoint;

    @Column(name = "prompt_tokens")
    private Integer promptTokens = 0;

    @Column(name = "completion_tokens")
    private Integer completionTokens = 0;

    @Column(name = "total_tokens")
    private Integer totalTokens = 0;

    @Column(name = "estimated_cost")
    private Double estimatedCost = 0.0;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    public AiUsageLog() {}

    public AiUsageLog(String deviceHash, String endpoint, Integer promptTokens, Integer completionTokens,
                      Integer totalTokens, Double estimatedCost, String status) {
        this.deviceHash = deviceHash;
        this.endpoint = endpoint;
        this.promptTokens = promptTokens;
        this.completionTokens = completionTokens;
        this.totalTokens = totalTokens;
        this.estimatedCost = estimatedCost;
        this.status = status;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getDeviceHash() { return deviceHash; }
    public String getEndpoint() { return endpoint; }
    public Integer getPromptTokens() { return promptTokens; }
    public Integer getCompletionTokens() { return completionTokens; }
    public Integer getTotalTokens() { return totalTokens; }
    public Double getEstimatedCost() { return estimatedCost; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setDeviceHash(String deviceHash) { this.deviceHash = deviceHash; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    public void setPromptTokens(Integer promptTokens) { this.promptTokens = promptTokens; }
    public void setCompletionTokens(Integer completionTokens) { this.completionTokens = completionTokens; }
    public void setTotalTokens(Integer totalTokens) { this.totalTokens = totalTokens; }
    public void setEstimatedCost(Double estimatedCost) { this.estimatedCost = estimatedCost; }
    public void setStatus(String status) { this.status = status; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
