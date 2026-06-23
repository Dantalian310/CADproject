package com.cloudcad.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Component
public class JwtTokenProvider {
    private final ObjectMapper objectMapper;
    private final String secret;
    private final long expirationMinutes;

    public JwtTokenProvider(
        ObjectMapper objectMapper,
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.expiration-minutes}") long expirationMinutes
    ) {
        this.objectMapper = objectMapper;
        this.secret = secret;
        this.expirationMinutes = expirationMinutes;
    }

    public String createToken(Long userId, String username) {
        try {
            String header = encodeJson(objectMapper.createObjectNode()
                .put("alg", "HS256")
                .put("typ", "JWT"));
            String payload = encodeJson(objectMapper.createObjectNode()
                .put("sub", userId)
                .put("username", username)
                .put("exp", Instant.now().plusSeconds(expirationMinutes * 60).getEpochSecond()));
            String signingInput = header + "." + payload;
            return signingInput + "." + sign(signingInput);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to create token", exception);
        }
    }

    public Optional<AuthenticatedUser> parseToken(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Optional.empty();
            }
            String signingInput = parts[0] + "." + parts[1];
            if (!constantTimeEquals(sign(signingInput), parts[2])) {
                return Optional.empty();
            }
            JsonNode payload = objectMapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
            if (payload.path("exp").asLong(0) < Instant.now().getEpochSecond()) {
                return Optional.empty();
            }
            return Optional.of(new AuthenticatedUser(payload.path("sub").asLong(), payload.path("username").asText()));
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    private String encodeJson(Object value) throws Exception {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(objectMapper.writeValueAsBytes(value));
    }

    private String sign(String signingInput) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
    }

    private boolean constantTimeEquals(String left, String right) {
        return java.security.MessageDigest.isEqual(
            left.getBytes(StandardCharsets.UTF_8),
            right.getBytes(StandardCharsets.UTF_8)
        );
    }
}
