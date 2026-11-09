package com.cook.backend;

import com.cook.backend.service.SafetyScanService;
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

@DisplayName("T15: Quét số liệu an toàn S1-S8 đọc trực tiếp từ docs/expected/T14.md")
class AiSafetyScanTest {

    private SafetyScanService safetyScanService;
    private JsonNode scanNode;

    @BeforeEach
    void setUp() throws IOException {
        safetyScanService = new SafetyScanService();

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

        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(matcher.group());
        this.scanNode = root.get("scan");
        assertNotNull(this.scanNode, "Khối JSON phải có phần scan");
    }

    @Test
    @DisplayName("S1-S8: Kiểm tra toàn bộ ca quét an toàn theo đúng kỳ vọng trong T14.md")
    void testAllSCases() {
        String expectedReplacement = scanNode.get("replacement").asText();

        for (JsonNode c : scanNode.get("cases")) {
            String id = c.get("id").asText();
            String text = c.get("text").asText();
            boolean expectedBlocked = c.get("blocked").asBoolean();

            boolean actualBlocked = safetyScanService.isBlocked(text);
            assertEquals(expectedBlocked, actualBlocked, "Ca " + id + " kiểm tra isBlocked không khớp: \"" + text + "\"");

            String filtered = safetyScanService.filterSafety(text);
            if (expectedBlocked) {
                assertEquals(expectedReplacement, filtered, "Ca " + id + " bị chặn phải thay bằng câu mẫu");
            } else {
                assertEquals(text, filtered, "Ca " + id + " không bị chặn phải giữ nguyên gốc");
            }
        }
    }
}
