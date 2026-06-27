package com.cloudcad.document.entity;

import com.cloudcad.project.entity.ProjectEntity;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.version.entity.DocumentVersionEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "documents")
public class DocumentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private ProjectEntity project;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_version_id")
    private DocumentVersionEntity currentVersion;

    @Column(name = "current_version_number", nullable = false)
    private Integer currentVersionNumber = 0;

    @Column(name = "snapshot_json", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> snapshotJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private UserEntity createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private UserEntity updatedBy;

    @Column(nullable = false)
    private Boolean deleted = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public ProjectEntity getProject() { return project; }
    public void setProject(ProjectEntity project) { this.project = project; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public DocumentVersionEntity getCurrentVersion() { return currentVersion; }
    public void setCurrentVersion(DocumentVersionEntity currentVersion) { this.currentVersion = currentVersion; }
    public Integer getCurrentVersionNumber() { return currentVersionNumber; }
    public void setCurrentVersionNumber(Integer currentVersionNumber) { this.currentVersionNumber = currentVersionNumber; }
    public Map<String, Object> getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(Map<String, Object> snapshotJson) { this.snapshotJson = snapshotJson; }
    public UserEntity getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserEntity createdBy) { this.createdBy = createdBy; }
    public UserEntity getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UserEntity updatedBy) { this.updatedBy = updatedBy; }
    public Boolean getDeleted() { return deleted; }
    public void setDeleted(Boolean deleted) { this.deleted = deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
