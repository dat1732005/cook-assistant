package com.cook.backend.service;

import org.springframework.stereotype.Service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SafetyScanService {

    public static final String DEFAULT_REPLACEMENT = "Vui lòng xem quy tắc an toàn trong app.";

    // 1. Nhiệt độ: số đi kèm °C, độ C, °F
    private static final Pattern TEMP_PATTERN = Pattern.compile(
            "\\d+\\s*(?:°C|độ\\s*C|°F)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    // 2. Hạn bảo quản: số đi kèm ngày, tuần, tháng
    private static final Pattern PRESERVATION_TIME_PATTERN = Pattern.compile(
            "\\d+\\s*(?:ngày|tuần|tháng)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    // 3. Số đi kèm giờ/tiếng
    private static final Pattern HOUR_PATTERN = Pattern.compile(
            "\\d+\\s*(?:giờ|tiếng)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    // Từ khóa nhạy cảm khi đi kèm giờ
    private static final Pattern PRESERVATION_KEYWORDS = Pattern.compile(
            "(?:tủ\\s*lạnh|bảo\\s*quản|ngăn\\s*đá|ngăn\\s*mát|hạn)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    public boolean isBlocked(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }

        // Kiểm tra nhiệt độ
        if (TEMP_PATTERN.matcher(text).find()) {
            return true;
        }

        // Kiểm tra số ngày/tuần/tháng
        if (PRESERVATION_TIME_PATTERN.matcher(text).find()) {
            return true;
        }

        // Kiểm tra số giờ đi kèm ngữ cảnh bảo quản/tủ lạnh
        Matcher hourMatcher = HOUR_PATTERN.matcher(text);
        if (hourMatcher.find()) {
            if (PRESERVATION_KEYWORDS.matcher(text).find()) {
                return true;
            }
        }

        return false;
    }

    public String filterSafety(String text) {
        if (isBlocked(text)) {
            return DEFAULT_REPLACEMENT;
        }
        return text;
    }
}
