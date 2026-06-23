package com.cloudcad.project.service;

import com.cloudcad.common.exception.BusinessException;
import com.cloudcad.common.exception.ErrorCode;
import com.cloudcad.document.repository.DocumentRepository;
import com.cloudcad.document.service.DocumentService;
import com.cloudcad.project.dto.AddProjectMemberRequest;
import com.cloudcad.project.dto.CreateProjectRequest;
import com.cloudcad.project.dto.CreateProjectInvitationRequest;
import com.cloudcad.project.dto.ProjectDTO;
import com.cloudcad.project.dto.ProjectInvitationDTO;
import com.cloudcad.project.dto.ProjectMemberDTO;
import com.cloudcad.project.dto.UpdateMemberRoleRequest;
import com.cloudcad.project.entity.ProjectEntity;
import com.cloudcad.project.entity.ProjectInvitationEntity;
import com.cloudcad.project.entity.ProjectInvitationStatus;
import com.cloudcad.project.entity.ProjectMemberEntity;
import com.cloudcad.project.entity.ProjectRole;
import com.cloudcad.project.repository.ProjectInvitationRepository;
import com.cloudcad.project.repository.ProjectMemberRepository;
import com.cloudcad.project.repository.ProjectRepository;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.repository.UserRepository;
import com.cloudcad.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectInvitationRepository projectInvitationRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final DocumentRepository documentRepository;
    private final DocumentService documentService;
    private final ProjectPermissionService permissionService;

    public ProjectService(
        ProjectRepository projectRepository,
        ProjectMemberRepository projectMemberRepository,
        ProjectInvitationRepository projectInvitationRepository,
        UserRepository userRepository,
        UserService userService,
        DocumentRepository documentRepository,
        DocumentService documentService,
        ProjectPermissionService permissionService
    ) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectInvitationRepository = projectInvitationRepository;
        this.userRepository = userRepository;
        this.userService = userService;
        this.documentRepository = documentRepository;
        this.documentService = documentService;
        this.permissionService = permissionService;
    }

    @Transactional(readOnly = true)
    public List<ProjectDTO> listMyProjects(Long userId) {
        return projectMemberRepository.findByUserIdOrderByProjectUpdatedAtDesc(userId).stream()
            .filter(member -> !Boolean.TRUE.equals(member.getProject().getDeleted()))
            .map(member -> toDTO(member.getProject(), member.getRole()))
            .toList();
    }

    @Transactional
    public ProjectDTO createProject(CreateProjectRequest request, Long userId) {
        UserEntity owner = userService.getById(userId);
        ProjectEntity project = new ProjectEntity();
        project.setName(request.name());
        project.setDescription(request.description());
        project.setOwner(owner);
        project.setCreatedAt(Instant.now());
        project.setUpdatedAt(Instant.now());
        ProjectEntity savedProject = projectRepository.save(project);

        ProjectMemberEntity ownerMember = new ProjectMemberEntity();
        ownerMember.setProject(savedProject);
        ownerMember.setUser(owner);
        ownerMember.setRole(ProjectRole.OWNER);
        projectMemberRepository.save(ownerMember);

        documentService.createDefaultDocument(savedProject, owner);
        return toDTO(savedProject, ProjectRole.OWNER);
    }

    @Transactional(readOnly = true)
    public ProjectDTO getProject(Long projectId, Long userId) {
        ProjectMemberEntity member = permissionService.requireMember(projectId, userId);
        return toDTO(requireProject(projectId), member.getRole());
    }

    @Transactional
    public ProjectDTO updateProject(Long projectId, CreateProjectRequest request, Long userId) {
        permissionService.requireOwner(projectId, userId);
        ProjectEntity project = requireProject(projectId);
        project.setName(request.name());
        project.setDescription(request.description());
        project.setUpdatedAt(Instant.now());
        return toDTO(projectRepository.save(project), ProjectRole.OWNER);
    }

    @Transactional
    public boolean deleteProject(Long projectId, Long userId) {
        permissionService.requireOwner(projectId, userId);
        ProjectEntity project = requireProject(projectId);
        project.setDeleted(true);
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);
        return true;
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberDTO> listMembers(Long projectId, Long userId) {
        permissionService.requireMember(projectId, userId);
        return projectMemberRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
            .map(this::toMemberDTO)
            .toList();
    }

    @Transactional
    public ProjectMemberDTO addMember(Long projectId, AddProjectMemberRequest request, Long userId) {
        permissionService.requireOwner(projectId, userId);
        throw new BusinessException(ErrorCode.VALIDATION_ERROR, "成员需要先发送邀请，并由对方同意后加入项目");
    }

    @Transactional(readOnly = true)
    public List<ProjectInvitationDTO> listProjectInvitations(Long projectId, Long userId) {
        permissionService.requireOwner(projectId, userId);
        return projectInvitationRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
            .map(this::toInvitationDTO)
            .toList();
    }

    @Transactional
    public ProjectInvitationDTO inviteMember(Long projectId, CreateProjectInvitationRequest request, Long userId) {
        ProjectMemberEntity ownerMember = permissionService.requireOwner(projectId, userId);
        if (request.role() == ProjectRole.OWNER) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "邀请角色只能是 EDITOR 或 VIEWER");
        }
        ProjectEntity project = requireProject(projectId);
        UserEntity targetUser = findUserByAccount(request.account());
        if (Objects.equals(targetUser.getId(), userId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不能邀请自己加入项目");
        }
        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, targetUser.getId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "该用户已经是项目成员");
        }
        projectInvitationRepository
            .findByProjectIdAndInviteeIdAndStatus(projectId, targetUser.getId(), ProjectInvitationStatus.PENDING)
            .ifPresent(invitation -> {
                throw new BusinessException(ErrorCode.CONFLICT, "该用户已有待处理邀请");
            });

        ProjectInvitationEntity invitation = new ProjectInvitationEntity();
        invitation.setProject(project);
        invitation.setInviter(ownerMember.getUser());
        invitation.setInvitee(targetUser);
        invitation.setRole(request.role());
        invitation.setStatus(ProjectInvitationStatus.PENDING);
        return toInvitationDTO(projectInvitationRepository.save(invitation));
    }

    @Transactional(readOnly = true)
    public List<ProjectInvitationDTO> listMyPendingInvitations(Long userId) {
        return projectInvitationRepository
            .findByInviteeIdAndStatusOrderByCreatedAtDesc(userId, ProjectInvitationStatus.PENDING)
            .stream()
            .filter(invitation -> !Boolean.TRUE.equals(invitation.getProject().getDeleted()))
            .map(this::toInvitationDTO)
            .toList();
    }

    @Transactional
    public ProjectInvitationDTO acceptInvitation(Long invitationId, Long userId) {
        ProjectInvitationEntity invitation = requireInvitation(invitationId);
        requireInvitee(invitation, userId);
        requirePendingInvitation(invitation);
        if (projectMemberRepository.existsByProjectIdAndUserId(invitation.getProject().getId(), userId)) {
            invitation.setStatus(ProjectInvitationStatus.ACCEPTED);
            invitation.setRespondedAt(Instant.now());
            invitation.setUpdatedAt(Instant.now());
            return toInvitationDTO(projectInvitationRepository.save(invitation));
        }

        ProjectMemberEntity member = new ProjectMemberEntity();
        member.setProject(invitation.getProject());
        member.setUser(invitation.getInvitee());
        member.setRole(invitation.getRole());
        projectMemberRepository.save(member);

        invitation.setStatus(ProjectInvitationStatus.ACCEPTED);
        invitation.setRespondedAt(Instant.now());
        invitation.setUpdatedAt(Instant.now());
        invitation.getProject().setUpdatedAt(Instant.now());
        return toInvitationDTO(projectInvitationRepository.save(invitation));
    }

    @Transactional
    public ProjectInvitationDTO rejectInvitation(Long invitationId, Long userId) {
        ProjectInvitationEntity invitation = requireInvitation(invitationId);
        requireInvitee(invitation, userId);
        requirePendingInvitation(invitation);
        invitation.setStatus(ProjectInvitationStatus.REJECTED);
        invitation.setRespondedAt(Instant.now());
        invitation.setUpdatedAt(Instant.now());
        return toInvitationDTO(projectInvitationRepository.save(invitation));
    }

    @Transactional
    public ProjectInvitationDTO cancelInvitation(Long projectId, Long invitationId, Long userId) {
        permissionService.requireOwner(projectId, userId);
        ProjectInvitationEntity invitation = projectInvitationRepository.findByIdAndProjectId(invitationId, projectId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "项目邀请不存在"));
        requirePendingInvitation(invitation);
        invitation.setStatus(ProjectInvitationStatus.CANCELED);
        invitation.setRespondedAt(Instant.now());
        invitation.setUpdatedAt(Instant.now());
        return toInvitationDTO(projectInvitationRepository.save(invitation));
    }

    @Transactional
    public ProjectMemberDTO updateMemberRole(Long projectId, Long memberId, UpdateMemberRoleRequest request, Long userId) {
        permissionService.requireOwner(projectId, userId);
        if (request.role() == ProjectRole.OWNER) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不能将成员角色修改为 OWNER");
        }
        ProjectMemberEntity member = requireMember(projectId, memberId);
        if (member.getRole() == ProjectRole.OWNER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不能修改 OWNER 角色");
        }
        member.setRole(request.role());
        member.setUpdatedAt(Instant.now());
        return toMemberDTO(projectMemberRepository.save(member));
    }

    @Transactional
    public boolean removeMember(Long projectId, Long memberId, Long userId) {
        permissionService.requireOwner(projectId, userId);
        ProjectMemberEntity member = requireMember(projectId, memberId);
        if (member.getRole() == ProjectRole.OWNER || Objects.equals(member.getUser().getId(), userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不能移除项目 OWNER");
        }
        projectMemberRepository.delete(member);
        return true;
    }

    private ProjectEntity requireProject(Long projectId) {
        return projectRepository.findById(projectId)
            .filter(project -> !Boolean.TRUE.equals(project.getDeleted()))
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "项目不存在"));
    }

    private ProjectMemberEntity requireMember(Long projectId, Long memberId) {
        return projectMemberRepository.findByIdAndProjectId(memberId, projectId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "项目成员不存在"));
    }

    private ProjectInvitationEntity requireInvitation(Long invitationId) {
        return projectInvitationRepository.findById(invitationId)
            .filter(invitation -> !Boolean.TRUE.equals(invitation.getProject().getDeleted()))
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "项目邀请不存在"));
    }

    private void requireInvitee(ProjectInvitationEntity invitation, Long userId) {
        if (!Objects.equals(invitation.getInvitee().getId(), userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只能处理发送给自己的项目邀请");
        }
    }

    private void requirePendingInvitation(ProjectInvitationEntity invitation) {
        if (invitation.getStatus() != ProjectInvitationStatus.PENDING) {
            throw new BusinessException(ErrorCode.CONFLICT, "该邀请已处理");
        }
    }

    private UserEntity findUserByAccount(String account) {
        String normalized = account == null ? "" : account.trim();
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请输入用户名或邮箱");
        }
        return userRepository.findByEmail(normalized)
            .or(() -> userRepository.findByUsername(normalized))
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "用户不存在，请确认用户名或邮箱"));
    }

    public ProjectDTO toDTO(ProjectEntity project, ProjectRole myRole) {
        Long defaultDocumentId = documentRepository.findFirstByProjectIdAndDeletedFalseOrderByIdAsc(project.getId())
            .map(document -> document.getId())
            .orElse(null);
        return new ProjectDTO(
            project.getId(),
            project.getName(),
            project.getDescription(),
            project.getOwner().getId(),
            myRole,
            defaultDocumentId,
            project.getCreatedAt(),
            project.getUpdatedAt()
        );
    }

    public ProjectMemberDTO toMemberDTO(ProjectMemberEntity member) {
        return new ProjectMemberDTO(
            member.getId(),
            member.getProject().getId(),
            userService.toDTO(member.getUser()),
            member.getRole(),
            member.getCreatedAt()
        );
    }

    public ProjectInvitationDTO toInvitationDTO(ProjectInvitationEntity invitation) {
        return new ProjectInvitationDTO(
            invitation.getId(),
            invitation.getProject().getId(),
            invitation.getProject().getName(),
            userService.toDTO(invitation.getInviter()),
            userService.toDTO(invitation.getInvitee()),
            invitation.getRole(),
            invitation.getStatus(),
            invitation.getCreatedAt(),
            invitation.getUpdatedAt(),
            invitation.getRespondedAt()
        );
    }
}
