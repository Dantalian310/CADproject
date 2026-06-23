package com.cloudcad;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Locale;

final class WindowsNioPipeCompatibility {
    // Some Windows Java 17 environments can create AF_UNIX pipes but fail to connect them.
    // Force the JDK Pipe implementation to use its TCP loopback fallback before Tomcat opens selectors.
    private static final String DISABLE_PROPERTY = "cloudcad.windows.nioPipeFallback.disabled";

    private WindowsNioPipeCompatibility() {
    }

    static void enableTcpFallbackOnWindows() {
        if (!isWindows() || Boolean.getBoolean(DISABLE_PROPERTY)) {
            return;
        }

        try {
            Class<?> pipeImplClass = Class.forName("sun.nio.ch.PipeImpl");
            Field noUnixDomainSockets = pipeImplClass.getDeclaredField("noUnixDomainSockets");

            Class<?> unsafeClass = Class.forName("sun.misc.Unsafe");
            Field unsafeInstance = unsafeClass.getDeclaredField("theUnsafe");
            unsafeInstance.setAccessible(true);
            Object unsafe = unsafeInstance.get(null);

            Method staticFieldBase = unsafeClass.getMethod("staticFieldBase", Field.class);
            Method staticFieldOffset = unsafeClass.getMethod("staticFieldOffset", Field.class);
            Method putBoolean = unsafeClass.getMethod("putBoolean", Object.class, long.class, boolean.class);

            Object base = staticFieldBase.invoke(unsafe, noUnixDomainSockets);
            long offset = (long) staticFieldOffset.invoke(unsafe, noUnixDomainSockets);
            putBoolean.invoke(unsafe, base, offset, true);
        } catch (ReflectiveOperationException | RuntimeException ex) {
            System.err.println("CloudCAD warning: unable to force Java NIO Pipe TCP fallback on Windows: "
                    + ex.getMessage());
        }
    }

    private static boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");
    }
}