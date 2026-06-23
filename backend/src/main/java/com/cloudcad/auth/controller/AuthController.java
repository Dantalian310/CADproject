package com.cloudcad.auth.controller;

import com.cloudcad.auth.dto.AuthResponse;
import com.cloudcad.auth.dto.LoginRequest;
import com.cloudcad.auth.dto.RegisterRequest;
import com.cloudcad.auth.service.AuthService;
import com.cloudcad.common.api.ApiResponse;
import com.cloudcad.security.AuthenticatedUser;
import com.cloudcad.user.dto.UserDTO;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ApiResponse<UserDTO> me(@AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ApiResponse.ok(authService.currentUser(currentUser));
    }
}
