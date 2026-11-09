/**
 * File: apps/backend/src/main/java/com/cook/backend/ai/RealAiProvider.java
 * Làm gì: Khung gọi HTTP chung cho nhà cung cấp AI thật theo interface AiProvider (T20b):
 *         - Sử dụng java.net.http.HttpClient với timeout cấu hình được qua COOK_AI_TIMEOUT_MS.
 *         - Đọc khóa API (COOK_AI_API_KEY) và endpoint cấu hình từ biến môi trường, tuyệt đối không viết cứng nhà cung cấp.
 *         - tạm: chưa chọn nhà cung cấp AI cụ thể (OpenAI / Gemini / Anthropic...), đang chờ chủ dự án quyết định.
 * Nhận vào: SubstituteRequest hoặc AskRequest.
 * Trả ra: SubstituteResponse hoặc AskResponse giải mã từ JSON phản hồi, hoặc ném lỗi rõ nếu chưa cấu hình / timeout.
 * Ai gọi: AiService khi cook.ai.provider = real.
 * Bám theo: docs/tasks.md mục T15, docs/STATUS.md mục "Đang chờ" và yêu cầu T20b mục (3).
 */
package com.cook.backend.ai;

import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import com.cook.backend.exception.AiBadResponseException;
import com.cook.backend.exception.AiProviderNotConfiguredException;
import com.cook.backend.exception.AiTimeoutException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "cook.ai.provider", havingValue = "real")
public class RealAiProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(RealAiProvider.class);

    /** Thời gian chờ mặc định (mili-giây) khi gọi HTTP ra nhà cung cấp AI ngoài */
    public static final long DEFAULT_TIMEOUT_MS = 5000L;

    /** Giới hạn HTTP thành công tối thiểu và tối đa */
    private static final int HTTP_OK_MIN = 200;
    private static final int HTTP_OK_MAX_EXCLUSIVE = 300;

    private final String apiKey;
    private final String endpointUrl;
    private final String model;
    private final long timeoutMs;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    /**
     * Làm gì: Khởi tạo tối giản chỉ với khóa API (endpoint ở trạng thái chưa cấu hình, chờ chủ dự án).
     * Vào: apiKey (chuỗi khóa API từ môi trường hoặc test).
     * Ra: Đối tượng RealAiProvider.
     * Gọi bởi: StartupConfigTest và các kiểm thử khởi tạo trực tiếp.
     */
    public RealAiProvider(String apiKey) {
        this(apiKey, "", "MISSING", DEFAULT_TIMEOUT_MS);
    }

    /**
     * Làm gì: Constructor chính để Spring Boot tiêm cấu hình nhà cung cấp AI từ biến môi trường.
     * Vào: apiKey (COOK_AI_API_KEY), endpointUrl (COOK_AI_ENDPOINT_URL), model (COOK_AI_MODEL), timeoutMs (COOK_AI_TIMEOUT_MS).
     * Ra: RealAiProvider gắn sẵn java.net.http.HttpClient chuẩn JDK 21.
     * Gọi bởi: Spring Framework IoC Container khi cook.ai.provider = real.
     */
    @Autowired
    public RealAiProvider(
            @Value("${cook.ai.api-key:}") String apiKey,
            @Value("${cook.ai.endpoint-url:}") String endpointUrl,
            @Value("${cook.ai.model:MISSING}") String model,
            @Value("${cook.ai.timeout-ms:5000}") long timeoutMs) {
        this(
                apiKey,
                endpointUrl,
                model,
                timeoutMs,
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofMillis(Math.max(1000L, timeoutMs)))
                        .build(),
                new ObjectMapper()
        );
    }

    /**
     * Làm gì: Constructor cho phép tiêm HttpClient và ObjectMapper phục vụ unit test khung HTTP không gọi mạng thật.
     * Vào: apiKey, endpointUrl, model, timeoutMs, httpClient, objectMapper.
     * Ra: Đối tượng RealAiProvider kiểm thử được hoàn chỉnh luồng HTTP.
     * Gọi bởi: Constructor Spring và các lớp test JUnit (AiFeedbackAndRealProviderTest, AiMockHeaderTest).
     */
    public RealAiProvider(
            String apiKey,
            String endpointUrl,
            String model,
            long timeoutMs,
            HttpClient httpClient,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.endpointUrl = endpointUrl != null ? endpointUrl.trim().replaceAll("/+$", "") : "";
        this.model = (model != null && !model.trim().isEmpty()) ? model.trim() : "MISSING";
        this.timeoutMs = timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;

        if (this.apiKey.isEmpty()) {
            log.warn("RealAiProvider được bật nhưng chưa cấu hình COOK_AI_API_KEY.");
        }
        // Ghi log minh bạch trạng thái chưa chọn nhà cung cấp AI thật để chủ dự án dễ theo dõi
        if (!hasConfiguredEndpoint()) {
            log.info("RealAiProvider đang ở chế độ khung HTTP chờ cấu hình COOK_AI_ENDPOINT_URL (chưa chọn nhà cung cấp AI).");
        }
    }

    /**
     * Làm gì: Cho biết khung HTTP hiện đã được cấu hình địa chỉ endpoint của nhà cung cấp AI hay chưa.
     * Vào: Không có.
     * Ra: true nếu endpointUrl khác rỗng và khác "MISSING", ngược lại false.
     * Gọi bởi: buildHttpRequest() và kiểm thử đơn vị.
     */
    public boolean hasConfiguredEndpoint() {
        return !endpointUrl.isEmpty() && !"MISSING".equalsIgnoreCase(endpointUrl);
    }

    @Override
    public SubstituteResponse substitute(SubstituteRequest request) {
        log.info("Chuẩn bị khung HTTP gọi AI thật cho /substitute món={}", request.recipeId());
        // Đóng gói payload trung lập theo interface; sẽ ánh xạ chi tiết theo nhà cung cấp sau khi chủ dự án chọn
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("model", model);
        envelope.put("operation", "substitute");
        envelope.put("payload", request);
        return executeJsonPost("/substitute", envelope, SubstituteResponse.class);
    }

    @Override
    public AskResponse ask(AskRequest request) {
        log.info("Chuẩn bị khung HTTP gọi AI thật cho /ask");
        // Không ghi log nội dung request.question để tránh lưu câu hỏi nhạy cảm ra logs hệ thống
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("model", model);
        envelope.put("operation", "ask");
        envelope.put("payload", request);
        return executeJsonPost("/ask", envelope, AskResponse.class);
    }

    @Override
    public boolean isMock() {
        return false;
    }

    /**
     * Làm gì: Dựng HttpRequest chuẩn JSON kèm Bearer token và timeout để gửi tới API AI bên ngoài.
     * Vào: operationPath ("/substitute" hoặc "/ask"), requestBody (đối tượng JSON đầu vào).
     * Ra: HttpRequest sẵn sàng gửi qua HttpClient.
     * Ví dụ: endpointUrl="https://ai.example/v1", operationPath="/ask" -> POST tới "https://ai.example/v1/ask".
     * Gọi bởi: executeJsonPost() và test kiểm tra cấu trúc HTTP request.
     */
    HttpRequest buildHttpRequest(String operationPath, Object requestBody) {
        // Chặn ngay nếu chủ dự án chưa chọn nhà cung cấp và chưa đặt COOK_AI_ENDPOINT_URL
        if (!hasConfiguredEndpoint()) {
            throw new AiProviderNotConfiguredException(
                    "Chưa chọn nhà cung cấp AI thật (COOK_AI_ENDPOINT_URL đang để MISSING, chờ chủ dự án cấu hình)."
            );
        }
        // Chặn ngay nếu thiếu khóa API để không gửi request vô ích
        if (apiKey.isEmpty()) {
            throw new AiProviderNotConfiguredException(
                    "Thiếu biến môi trường COOK_AI_API_KEY cho nhà cung cấp AI thật."
            );
        }

        final String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(requestBody);
        } catch (JsonProcessingException e) {
            throw new AiBadResponseException("Không tuần tự hóa được payload gửi nhà cung cấp AI.");
        }

        String normalizedPath = operationPath.startsWith("/") ? operationPath : "/" + operationPath;
        URI targetUri = URI.create(endpointUrl + normalizedPath);

        return HttpRequest.newBuilder(targetUri)
                .timeout(Duration.ofMillis(timeoutMs))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                .build();
    }

    /**
     * Làm gì: Thực thi HTTP POST qua java.net.http.HttpClient, xử lý timeout / lỗi HTTP và giải mã DTO trả về.
     * Vào: operationPath (đường dẫn thao tác), payload (nội dung JSON gửi đi), responseType (kiểu DTO kỳ vọng).
     * Ra: Đối tượng kiểu T đã giải mã hợp lệ.
     * Gọi bởi: substitute() và ask().
     */
    private <T> T executeJsonPost(String operationPath, Object payload, Class<T> responseType) {
        HttpRequest httpRequest = buildHttpRequest(operationPath, payload);
        HttpResponse<String> httpResponse;

        try {
            httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (HttpTimeoutException e) {
            throw new AiTimeoutException("Yêu cầu gọi nhà cung cấp AI thật vượt quá " + timeoutMs + "ms.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AiBadResponseException("Luồng gọi nhà cung cấp AI thật bị ngắt giữa chừng.");
        } catch (IOException e) {
            throw new AiBadResponseException("Lỗi kết nối HTTP tới nhà cung cấp AI thật.");
        }

        int statusCode = httpResponse.statusCode();
        // Chặn mọi mã HTTP ngoài dải 2xx trước khi giải mã JSON
        if (statusCode < HTTP_OK_MIN || statusCode >= HTTP_OK_MAX_EXCLUSIVE) {
            throw new AiBadResponseException("Nhà cung cấp AI thật trả mã lỗi HTTP " + statusCode + ".");
        }

        try {
            T parsed = objectMapper.readValue(httpResponse.body(), responseType);
            if (parsed == null) {
                throw new AiBadResponseException("Nhà cung cấp AI thật trả về thân JSON rỗng.");
            }
            return parsed;
        } catch (JsonProcessingException e) {
            throw new AiBadResponseException("Đầu ra JSON từ nhà cung cấp AI thật không khớp schema kỳ vọng.");
        }
    }
}
