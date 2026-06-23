package com.cloudcad.project.entity;

import com.cloudcad.user.entity.UserEntity;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "project_invitations")
public class ProjectInvitationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private ProjectEntity project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inviter_id", nullable = false)
    private UserEntity inviter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invitee_id", nullable = false)
    private UserEntity invitee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProjectRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProjectInvitationStatus status = ProjectInvitationStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "responded_at")
    private Instant respondedAt;

    public Long getId() { return id; }
    public ProjectEntity getProject() { return project; }
    public void setProject(ProjectEntity project) { this.project = project; }
    public UserEntity getInviter() { return inviter; }
    public void setInviter(UserEntity inviter) { this.inviter = inviter; }
    public UserEntity getInvitee() { return invitee; }
    public void setInvitee(UserEntity invitee) { this.invitee = invitee; }
    public ProjectRole getRole() { return role; }
    public void setRole(ProjectRole role) { this.role = role; }
    public ProjectInvitationStatus getStatus() { return status; }
    public void setStatus(ProjectInvitationStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getRespondedAt() { return respondedAt; }
    public void setRespondedAt(Instant respondedAt) { this.respondedAt = respondedAt; }
}
