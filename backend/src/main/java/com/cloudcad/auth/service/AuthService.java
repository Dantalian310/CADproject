package com.cloudcad.auth.service;

import com.cloudcad.auth.dto.AuthResponse;
import com.cloudcad.auth.dto.LoginRequest;
import com.cloudcad.auth.dto.RegisterRequest;
import com.cloudcad.common.exception.BusinessException;
import com.cloudcad.common.exception.ErrorCode;
import com.cloudcad.security.JwtTokenProvider;
import com.cloudcad.security.AuthenticatedUser;
import com.cloudcad.user.dto.UserDTO;
import com.cloudcad.user.entity.UserEntity;
import com.cloudcad.user.repository.UserRepository;
import com.cloudcad.user.service.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(
        UserRepository userRepository,
        UserService userService,
        PasswordEncoder passwordEncoder,
        JwtTokenProvider jwtTokenProvider
    ) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new BusinessException(ErrorCode.CONFLICT, "用户名已存在");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(ErrorCode.CONFLICT, "邮箱已存在");
        }
        UserEntity user = new UserEntity();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setDisplayName(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        UserEntity saved = userRepository.save(user);
        return toAuthResponse(saved);
    }

    public AuthResponse login(LoginRequest request) {
        UserEntity user = userRepository.findByUsername(request.username())
            .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "用户名或密码错误"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "用户名或密码错误");
        }
        return toAuthResponse(user);
    }

    public UserDTO currentUser(AuthenticatedUser currentUser) {
        return userService.toDTO(userService.getById(currentUser.id()));
    }

    private AuthResponse toAuthResponse(UserEntity user) {
        return new AuthResponse(jwtTokenProvider.createToken(user.getId(), user.getUsername()), userService.toDTO(user));
    }
}
