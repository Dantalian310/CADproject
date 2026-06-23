package com.cloudcad;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CloudCadApplication {
    public static void main(String[] args) {
        WindowsNioPipeCompatibility.enableTcpFallbackOnWindows();
        SpringApplication.run(CloudCadApplication.class, args);
    }
}
