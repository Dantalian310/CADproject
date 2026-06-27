package com.cloudcad;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class CloudCadApplication {
    public static void main(String[] args) {
        WindowsNioPipeCompatibility.enableTcpFallbackOnWindows();
        SpringApplication.run(CloudCadApplication.class, args);
    }
}
