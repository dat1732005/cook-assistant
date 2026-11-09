package com.cook.backend;

import com.cook.backend.ai.MockAiProvider;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import com.cook.backend.exception.AiBadResponseException;
import com.cook.backend.exception.AiTimeoutException;
import com.cook.backend.repository.AiUsageLogRepository;
import com.cook.backend.service.AiService;
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
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@DisplayName("T15: Kiểm tra đầu ra thay hoặc bỏ nguyên liệu U1-U6 đọc từ docs/expected/T14.md")
class AiSubstituteTest {

    private MockAiProvider mockAiProvider;
    private AiService aiService;
    private JsonNode substituteNode;

    @BeforeEach
    void setUp() throws IOException {
        mockAiProvider = new MockAiProvider();
        SafetyScanService safetyScanService = new SafetyScanService();
        AiUsageLogRepository usageLogRepo = mock(AiUsageLogRepository.class);

        this.aiService = new AiService(mockAiProvider, safetyScanService, usageLogRepo, true);

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
        this.substituteNode = root.get("substitute");
        assertNotNull(this.substituteNode, "Khối JSON phải có phần substitute");
    }

    @Test
    @DisplayName("U1: Bỏ nguyên liệu preservation -> severity=high, confirm_required=true")
    void testU1() {
        JsonNode u1 = findCase("U1");
        String role = u1.get("role").asText();

        SubstituteRequest req = new SubstituteRequest(
                "mon-1", "omit", "muoi", role, "salt", List.of(), List.of(), Map.of(), "U1"
        );

        SubstituteResponse res = aiService.handleSubstitute(req, "test-device");
        assertEquals(u1.get("final").get("severity").asText(), res.severity());
        assertEquals(u1.get("final").get("confirm_required").asBoolean(), res.confirmRequired());
    }

    @Test
    @DisplayName("U2: Gợi ý dính dị ứng của người dùng -> bị loại khỏi danh sách gợi ý")
    void testU2() {
        JsonNode u2 = findCase("U2");
        List<String> allergies = new ArrayList<>();
        u2.get("allergies").forEach(a -> allergies.add(a.asText()));

        Map<String, List<String>> ingredientAllergens = new HashMap<>();
        u2.get("ingredient_allergens").fields().forEachRemaining(entry -> {
            List<String> codes = new ArrayList<>();
            entry.getValue().forEach(c -> codes.add(c.asText()));
            ingredientAllergens.put(entry.getKey(), codes);
        });

        SubstituteRequest req = new SubstituteRequest(
                "mon-2", "substitute", "dau-an", "fat", "fat", allergies, List.of("dau-phong", "dau-me"), ingredientAllergens, "U2"
        );

        SubstituteResponse res = aiService.handleSubstitute(req, "test-device");
        assertEquals(0, res.suggestions().size(), "Gợi ý dau-phong phải bị loại do dính dị ứng peanut");
    }

    @Test
    @DisplayName("U3: Gợi ý ngo-ri không có trong bảng nguyên liệu chuẩn -> bị loại")
    void testU3() {
        JsonNode u3 = findCase("U3");
        List<String> known = new ArrayList<>();
        u3.get("known_ingredients").forEach(k -> known.add(k.asText()));

        SubstituteRequest req = new SubstituteRequest(
                "mon-3", "substitute", "hanh-la", "flavor", "spice", List.of(), known, Map.of(), "U3"
        );

        SubstituteResponse res = aiService.handleSubstitute(req, "test-device");
        assertEquals(0, res.suggestions().size(), "Gợi ý ngo-ri không có trong known_ingredients phải bị loại");
    }

    @Test
    @DisplayName("U4: AI trả JSON sai schema hai lần liên tiếp -> ném lỗi AI_BAD_RESPONSE (gọi 2 lần)")
    void testU4() {
        JsonNode u4 = findCase("U4");
        List<String> responses = new ArrayList<>();
        u4.get("responses").forEach(r -> responses.add(r.asText()));
        mockAiProvider.setSimulateResponses(responses);

        SubstituteRequest req = new SubstituteRequest(
                "mon-4", "substitute", "toi", "flavor", "spice", List.of(), List.of("toi"), Map.of(), "U4"
        );

        assertThrows(AiBadResponseException.class, () -> aiService.handleSubstitute(req, "test-device"));
        assertEquals(u4.get("ai_calls").asInt(), mockAiProvider.getCallCount(), "Phải gọi AI đúng 2 lần trước khi báo lỗi");
    }

    @Test
    @DisplayName("U5: AI quá thời gian chờ -> ném lỗi AI_TIMEOUT")
    void testU5() {
        mockAiProvider.setSimulateTimeout(true);

        SubstituteRequest req = new SubstituteRequest(
                "mon-5", "substitute", "ot", "flavor", "spice", List.of(), List.of("ot"), Map.of(), "U5"
        );

        assertThrows(AiTimeoutException.class, () -> aiService.handleSubstitute(req, "test-device"));
    }

    @Test
    @DisplayName("U6: AI sai schema lần 1, đúng lần 2 -> thành công, đúng 2 lần gọi AI")
    void testU6() {
        JsonNode u6 = findCase("U6");
        List<String> responses = new ArrayList<>();
        u6.get("responses").forEach(r -> responses.add(r.asText()));
        mockAiProvider.setSimulateResponses(responses);

        SubstituteRequest req = new SubstituteRequest(
                "mon-6", "substitute", "gung", "flavor", "spice", List.of(), List.of("gung", "hanh-la"), Map.of(), "U6"
        );

        SubstituteResponse res = aiService.handleSubstitute(req, "test-device");
        assertNotNull(res);
        assertEquals(u6.get("ai_calls").asInt(), mockAiProvider.getCallCount(), "Phải gọi AI đúng 2 lần");
    }

    private JsonNode findCase(String id) {
        for (JsonNode c : substituteNode) {
            if (c.get("id").asText().equals(id)) {
                return c;
            }
        }
        throw new IllegalArgumentException("Không tìm thấy ca " + id);
    }
}
