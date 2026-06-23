package com.cloudcad.project.service;

import com.cloudcad.common.exception.BusinessException;
import com.cloudcad.common.exception.ErrorCode;
import com.cloudcad.project.entity.ProjectMemberEntity;
import com.cloudcad.project.entity.ProjectRole;
import com.cloudcad.project.repository.ProjectMemberRepository;
import org.springframework.stereotype.Service;

@Service
public class ProjectPermissionService {
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectPermissionService(ProjectMemberRepository projectMemberRepository) {
        this.projectMemberRepository = projectMemberRepository;
    }

    public ProjectMemberEntity requireMember(Long projectId, Long userId) {
        return projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "当前用户不是项目成员"));
    }

    public ProjectMemberEntity requireEditor(Long projectId, Long userId) {
        ProjectMemberEntity member = requireMember(projectId, userId);
        if (member.getRole() == ProjectRole.VIEWER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "当前用户没有编辑权限");
        }
        return member;
    }

    public ProjectMemberEntity requireOwner(Long projectId, Long userId) {
        ProjectMemberEntity member = requireMember(projectId, userId);
        if (member.getRole() != ProjectRole.OWNER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有项目 OWNER 可以执行该操作");
        }
        return member;
    }
}
