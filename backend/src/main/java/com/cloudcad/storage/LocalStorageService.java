package com.cloudcad.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class LocalStorageService implements StorageService {
    private final Path root;

    public LocalStorageService(@Value("${app.storage.local-root}") String localRoot) {
        this.root = Path.of(localRoot).toAbsolutePath().normalize();
    }

    @Override
    public String save(String path, byte[] content) {
        try {
            Path target = resolve(path);
            Files.createDirectories(target.getParent());
            Files.write(target, content);
            return root.relativize(target).toString().replace('\\', '/');
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to save local file", exception);
        }
    }

    @Override
    public byte[] read(String path) {
        try {
            return Files.readAllBytes(resolve(path));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read local file", exception);
        }
    }

    @Override
    public void delete(String path) {
        try {
            Files.deleteIfExists(resolve(path));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to delete local file", exception);
        }
    }

    private Path resolve(String path) {
        Path target = root.resolve(path).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage path");
        }
        return target;
    }
}
