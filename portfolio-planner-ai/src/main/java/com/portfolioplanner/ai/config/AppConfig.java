package com.portfolioplanner.ai.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    /**
     * ChatClient with system prompt grounding the LLM in portfolio planning domain.
     * RAG retrieval is handled manually in RagService (vectorStore.similaritySearch),
     * so no QuestionAnswerAdvisor needed here — this keeps us decoupled from
     * Spring AI advisor API changes between versions.
     */
    @Bean
    public ChatClient chatClient(OllamaChatModel chatModel) {
        return ChatClient.builder(chatModel)
                .defaultSystem("""
                        You are an intelligent assistant embedded in Portfolio Planner, \
                        an engineering portfolio management platform.

                        Your role is to answer questions about projects, risks, milestones, \
                        resources, and team capacity using ONLY the context provided.

                        Rules:
                        - Base every answer strictly on the retrieved context below.
                        - If the context does not contain enough information, say clearly: \
                          "I don't have enough data to answer that confidently."
                        - Be concise and direct — this is a professional tool, not a chatbot.
                        - When referencing projects or risks, include their names.
                        - For health/status questions, cite the health score or status value.
                        - Never hallucinate metrics, names, or dates.
                        """)
                .build();
    }

    /**
     * RestTemplate for async webhook calls (AI sync publisher).
     */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
