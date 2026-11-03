package com.cook.backend;

import com.cook.backend.service.SlidingWindowRateLimiter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("T14: Giới hạn lượt cửa sổ trượt (R1-R5) đọc trực tiếp từ docs/expected/T14.md")
class RateLimitTest {

    private SlidingWindowRateLimiter rateLimiter;
    private JsonNode rateLimitNode;

    @BeforeEach
    void setUp() throws IOException {
        rateLimiter = new SlidingWindowRateLimiter(3, 60);

        // Đọc tệp docs/expected/T14.md
        Path t14Path = Paths.get("../../docs/expected/T14.md");
        if (!Files.exists(t14Path)) {
            t14Path = Paths.get("docs/expected/T14.md");
        }
        if (!Files.exists(t14Path)) {
            t14Path = Paths.get("../../../docs/expected/T14.md");
        }

        assertTrue(Files.exists(t14Path), "Phải tìm thấy tệp docs/expected/T14.md");

        String content = Files.readString(t14Path);
        Matcher matcher = Pattern.compile("\\{.*\"case\"\\s*:\\s*\"RSU\".*\\}").matcher(content);
        assertTrue(matcher.find(), "docs/expected/T14.md phải chứa khối JSON RSU");

        String jsonStr = matcher.group();
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(jsonStr);
        this.rateLimitNode = root.get("rate_limit");
        assertNotNull(this.rateLimitNode, "Khối JSON phải có phần rate_limit");
    }

    @Test
    @DisplayName("R1: Thiết bị d1 gọi 3 lần tại mốc 0, 10, 20s đều thành công")
    void testR1() {
        int limit = rateLimitNode.get("limit").asInt();
        int window = rateLimitNode.get("window_seconds").asInt();
        JsonNode r1 = findCase("R1");
        String device = r1.get("device").asText();

        for (JsonNode callAt : r1.get("calls")) {
            long at = callAt.asLong();
            SlidingWindowRateLimiter.RateLimitResult res = rateLimiter.check(device, at, limit, window);
            assertTrue(res.allowed(), "Mốc " + at + "s phải thành công");
        }
    }

    @Test
    @DisplayName("R1-R5: Chuỗi ca kiểm thử tuần tự đúng quy định trong docs/expected/T14.md")
    void testAllRCasesInSequence() {
        int limit = rateLimitNode.get("limit").asInt();
        int window = rateLimitNode.get("window_seconds").asInt();

        // R1: d1 gọi lúc 0, 10, 20s
        JsonNode r1 = findCase("R1");
        String d1 = r1.get("device").asText();
        for (JsonNode callAt : r1.get("calls")) {
            SlidingWindowRateLimiter.RateLimitResult res = rateLimiter.check(d1, callAt.asLong(), limit, window);
            assertTrue(res.allowed(), "R1 call at " + callAt.asLong() + " phải được cho phép");
        }

        // R2: d1 gọi thêm lúc 30s -> bị chặn 429, retry_after = 30
        JsonNode r2 = findCase("R2");
        long r2At = r2.get("at").asLong();
        SlidingWindowRateLimiter.RateLimitResult resR2 = rateLimiter.check(d1, r2At, limit, window);
        assertFalse(resR2.allowed(), "R2 lúc " + r2At + "s phải bị từ chối");
        assertEquals(r2.get("result").get("retry_after").asLong(), resR2.retryAfter(), "R2 retry_after phải khớp");

        // R3: d1 gọi thêm lúc 61s -> thành công (lượt lúc 0 đã ra khỏi cửa sổ)
        JsonNode r3 = findCase("R3");
        long r3At = r3.get("at").asLong();
        SlidingWindowRateLimiter.RateLimitResult resR3 = rateLimiter.check(d1, r3At, limit, window);
        assertTrue(resR3.allowed(), "R3 lúc " + r3At + "s phải thành công");

        // R4: d1 gọi thêm lúc 62s -> bị chặn 429, retry_after = 8
        JsonNode r4 = findCase("R4");
        long r4At = r4.get("at").asLong();
        SlidingWindowRateLimiter.RateLimitResult resR4 = rateLimiter.check(d1, r4At, limit, window);
        assertFalse(resR4.allowed(), "R4 lúc " + r4At + "s phải bị từ chối");
        assertEquals(r4.get("result").get("retry_after").asLong(), resR4.retryAfter(), "R4 retry_after phải khớp");

        // R5: thiết bị d2 gọi lúc 30s -> thành công (đếm riêng theo thiết bị)
        JsonNode r5 = findCase("R5");
        String d2 = r5.get("device").asText();
        long r5At = r5.get("at").asLong();
        SlidingWindowRateLimiter.RateLimitResult resR5 = rateLimiter.check(d2, r5At, limit, window);
        assertTrue(resR5.allowed(), "R5 thiết bị khác lúc " + r5At + "s phải thành công");
    }

    private JsonNode findCase(String id) {
        for (JsonNode c : rateLimitNode.get("cases")) {
            if (c.get("id").asText().equals(id)) {
                return c;
            }
        }
        throw new IllegalArgumentException("Không tìm thấy ca " + id);
    }
}
