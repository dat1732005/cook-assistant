package com.cook.backend.ai;

import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;

public interface AiProvider {

    /**
     * Gọi mô hình AI để tư vấn thay thế hoặc bỏ nguyên liệu.
     * @param request Yêu cầu thay/bỏ nguyên liệu
     * @return Phản hồi cấu trúc từ AI
     */
    SubstituteResponse substitute(SubstituteRequest request);

    /**
     * Gọi mô hình AI để trả lời câu hỏi nấu ăn.
     * @param request Câu hỏi và ngữ cảnh nấu
     * @return Phản hồi câu trả lời
     */
    AskResponse ask(AskRequest request);

    /**
     * Cho biết provider này có phải là bản giả lập (mock) hay không.
     * @return true nếu là AI giả lập, false nếu là AI thật.
     */
    boolean isMock();
}
