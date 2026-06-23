package com.cloudcad.collaboration.service;

import com.cloudcad.collaboration.dto.OperationMessage;
import org.springframework.stereotype.Service;

@Service
public class ConflictService {
    public boolean hasConflict(OperationMessage message, int serverVersion) {
        return message.baseVersion() != null && message.baseVersion() < serverVersion;
    }
}
