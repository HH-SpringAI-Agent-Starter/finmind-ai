package com.example.finmind.config;

import com.example.finmind.agent.SystemPrompts;
import com.example.finmind.rag.FinancialKnowledgeTools;
import com.example.finmind.tools.FinancialCalculatorTools;
import com.example.finmind.tools.MarketAnomalyTools;
import com.example.finmind.tools.MarketDataTools;
import com.example.finmind.tools.SecFilingTools;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(FinMindProperties.class)
public class ChatConfig {

    @Bean
    ChatClient financeChatClient(
            ChatClient.Builder builder,
            FinancialKnowledgeTools financialKnowledgeTools,
            MarketDataTools marketDataTools,
            SecFilingTools secFilingTools,
            FinancialCalculatorTools financialCalculatorTools,
            MarketAnomalyTools marketAnomalyTools
    ) {
        return builder
                .defaultSystem(SystemPrompts.FINANCE_AGENT)
                .defaultTools(
                        financialKnowledgeTools,
                        marketDataTools,
                        secFilingTools,
                        financialCalculatorTools,
                        marketAnomalyTools
                )
                .build();
    }
}
