package com.cook.backend.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("T14: GET /health kiểm tra trạng thái CSDL")
class HealthControllerTest {

    @Test
    @DisplayName("CSDL hoạt động bình thường -> HTTP 200, status=UP, database=UP")
    void healthDatabaseUp() throws Exception {
        DataSource mockDataSource = mock(DataSource.class);
        Connection mockConnection = mock(Connection.class);

        when(mockDataSource.getConnection()).thenReturn(mockConnection);
        when(mockConnection.isValid(anyInt())).thenReturn(true);

        HealthController controller = new HealthController(mockDataSource);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"));
    }

    @Test
    @DisplayName("CSDL mất kết nối -> HTTP 503, status=DOWN, database=DOWN")
    void healthDatabaseDown() throws Exception {
        DataSource mockDataSource = mock(DataSource.class);

        when(mockDataSource.getConnection()).thenThrow(new SQLException("Connection refused"));

        HealthController controller = new HealthController(mockDataSource);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        mockMvc.perform(get("/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"))
                .andExpect(jsonPath("$.database").value("DOWN"));
    }
}
