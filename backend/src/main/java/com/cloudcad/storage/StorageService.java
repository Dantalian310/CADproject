package com.cloudcad.storage;

public interface StorageService {
    String save(String path, byte[] content);
    byte[] read(String path);
    void delete(String path);
}
