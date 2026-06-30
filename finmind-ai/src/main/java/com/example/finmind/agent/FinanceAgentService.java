package com.example.finmind.agent;

import com.example.finmind.web.dto.AgentResponse;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class FinanceAgentService {

    private final ChatClient chatClient;

    public FinanceAgentService(ChatClient financeChatClient) {
        this.chatClient = financeChatClient;
    }

    public AgentResponse ask(String question, String ticker, String companyName, String market, String horizon, String riskProfile) {
        String contextualQuestion = """
                用户问题：%s

                股票代码 / Ticker：%s
                公司名称：%s
                市场：%s
                分析周期：%s
                风险偏好：%s

                请在回答中明确说明：
                - 使用了哪些工具和数据源；
                - 数据日期、单位和局限；
                - 不构成投资建议。
                """.formatted(
                question,
                valueOrUnknown(ticker),
                valueOrUnknown(companyName),
                valueOrUnknown(market),
                valueOrUnknown(horizon),
                valueOrUnknown(riskProfile)
        );

        String answer = chatClient.prompt()
                .user(contextualQuestion)
                .call()
                .content();

        return new AgentResponse(
                UUID.randomUUID().toString(),
                answer,
                Instant.now()
        );
    }

    private String valueOrUnknown(String value) {
        return value == null || value.isBlank() ? "未知" : value;
    }
}
