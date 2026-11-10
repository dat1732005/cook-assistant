package com.cook.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SlidingWindowRateLimiter {

    public record RateLimitResult(boolean allowed, long retryAfter) {
        public static RateLimitResult ok() {
            return new RateLimitResult(true, 0);
        }
        public static RateLimitResult rejected(long retryAfter) {
            return new RateLimitResult(false, retryAfter);
        }
    }

    private final int defaultLimit;
    private final int defaultWindowSeconds;
    private final Map<String, List<Long>> deviceCallTimestamps = new ConcurrentHashMap<>();

    public SlidingWindowRateLimiter(
            @Value("${cook.rate-limit.limit:5}") int defaultLimit,
            @Value("${cook.rate-limit.window-seconds:3600}") int defaultWindowSeconds) {
        this.defaultLimit = Math.max(1, defaultLimit);
        this.defaultWindowSeconds = Math.max(1, defaultWindowSeconds);
    }

    /** Trả về số lượt tối đa trong một cửa sổ trượt đang cấu hình từ biến môi trường (T21.9). */
    public int getDefaultLimit() {
        return defaultLimit;
    }

    /** Trả về độ dài cửa sổ trượt tính bằng giây đang cấu hình từ biến môi trường (T21.9). */
    public int getDefaultWindowSeconds() {
        return defaultWindowSeconds;
    }

    public synchronized RateLimitResult check(String deviceKey) {
        long nowSeconds = System.currentTimeMillis() / 1000L;
        return check(deviceKey, nowSeconds, defaultLimit, defaultWindowSeconds);
    }

    public synchronized RateLimitResult check(String deviceKey, long nowSeconds, int limit, int windowSeconds) {
        List<Long> timestamps = deviceCallTimestamps.computeIfAbsent(deviceKey, k -> new ArrayList<>());

        // Loại bỏ các lượt gọi ngoài cửa sổ trượt (trước nowSeconds - windowSeconds)
        long windowStart = nowSeconds - windowSeconds;
        Iterator<Long> iter = timestamps.iterator();
        while (iter.hasNext()) {
            if (iter.next() <= windowStart) {
                iter.remove();
            }
        }

        if (timestamps.size() < limit) {
            timestamps.add(nowSeconds);
            return RateLimitResult.ok();
        }

        // Đã đạt giới hạn -> Tính thời gian cần chờ đến khi lượt sớm nhất hết hạn
        long oldestCall = timestamps.get(0);
        long retryAfter = (oldestCall + windowSeconds) - nowSeconds;
        if (retryAfter <= 0) {
            retryAfter = 1;
        }

        return RateLimitResult.rejected(retryAfter);
    }

    public synchronized void reset() {
        deviceCallTimestamps.clear();
    }
}
