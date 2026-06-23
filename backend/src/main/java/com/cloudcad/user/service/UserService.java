package com.cloudcad.user.service;

import com.cloudcad.common.exception.BusinessException;
import com.cloudcad.common.exception.ErrorCode;
import com.cloudcad.user.dto.UserDTO;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserEntity getById(Long userId) {
        return userRepository.findById(userId)
            .filter(user -> Boolean.TRUE.equals(user.getEnabled()))
            .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "用户不存在或已禁用"));
    }

    public UserDTO toDTO(UserEntity user) {
        return new UserDTO(user.getId(), user.getUsername(), user.getEmail(), user.getDisplayName());
    }
}
