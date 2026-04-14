package com.portfolioplanner.ai.rag;

import com.portfolioplanner.ai.api.dto.QueryRequest;
import com.portfolioplanner.ai.api.dto.QueryResponse;
import com.portfolioplanner.ai.api.dto.SourceReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Core RAG pipeline:
 *  1. Embed the user query
 *  2. Retrieve top-K relevant chunks from pgvector
 *  3. Inject chunks as context into the ChatClient prompt
 *  4. Call Ollama for synthesis
 *  5. Persist conversation log
 *  6. Return answer + source references
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RagService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;
    private final JdbcTemplate jdbc;

    @Value("${ai.rag.top-k:8}")
    private int topK;

    @Value("${ai.rag.min-score:0.55}")
    private double minScore;

    public QueryResponse query(QueryRequest request) {
        long startMs = System.currentTimeMillis();
        String sessionId = request.sessionId() != null ? request.sessionId()
                : UUID.randomUUID().toString();

        log.debug("RAG query [session={}]: {}", sessionId, request.query());

        try {
            // ── 1. Retrieve relevant chunks manually (so we can surface sources)
            List<Document> retrieved = vectorStore.similaritySearch(
                    SearchRequest.builder()
                            .query(request.query())
                            .topK(topK)
                            .similarityThreshold(minScore)
                            .build()
            );

            if (retrieved.isEmpty()) {
                String fallback = "I couldn't find relevant project data for that query. " +
                        "Try asking about a specific project name, risk, or milestone.";
                persistConversation(sessionId, request.query(), fallback, List.of(), "none",
                        (int)(System.currentTimeMillis() - startMs));
                return new QueryResponse(fallback, List.of(), sessionId, false);
            }

            // ── 2. Build context block from retrieved chunks
            StringBuilder contextBlock = new StringBuilder();
            List<SourceReference> sources = new ArrayList<>();

            for (Document doc : retrieved) {
                contextBlock.append(doc.getText()).append("\n---\n");
                Map<String, Object> meta = doc.getMetadata();
                sources.add(new SourceReference(
                        str(meta.get("entity_type")),
                        str(meta.get("entity_id")),
                        str(meta.get("project_name")),
                        str(meta.get("chunk_type"))
                ));
            }

            // ── 3. Compose prompt: context + user question
            String augmentedPrompt = """
                    CONTEXT (retrieved from portfolio data):
                    %s

                    QUESTION: %s
                    """.formatted(contextBlock, request.query());

            // ── 4. Call Ollama via ChatClient (system prompt already set in AppConfig)
            String answer = chatClient.prompt()
                    .user(augmentedPrompt)
                    .call()
                    .content();

            long latencyMs = System.currentTimeMillis() - startMs;
            log.debug("RAG answered in {}ms, {} chunks used", latencyMs, retrieved.size());

            // ── 5. Persist conversation
            persistConversation(sessionId, request.query(), answer, sources, "ollama", (int) latencyMs);

            return new QueryResponse(answer, sources, sessionId, true);

        } catch (Exception e) {
            log.error("RAG query failed: {}", e.getMessage(), e);
            String errMsg = "The AI service encountered an error: " + e.getMessage() +
                    ". Please ensure Ollama is running (`ollama serve`) and the model is pulled.";
            return new QueryResponse(errMsg, List.of(), sessionId, false);
        }
    }

    private void persistConversation(String sessionId, String query, String response,
                                     List<SourceReference> sources, String model, int latencyMs) {
        try {
            String sourcesJson = buildSourcesJson(sources);
            jdbc.update(
                    "INSERT INTO ai.conversations " +
                    "(session_id, query, response, sources, model_used, latency_ms) " +
                    "VALUES (?, ?, ?, ?::jsonb, ?, ?)",
                    sessionId, query, response, sourcesJson, model, latencyMs);
        } catch (Exception e) {
            log.warn("Failed to persist conversation log: {}", e.getMessage());
        }
    }

    private String buildSourcesJson(List<SourceReference> sources) {
        if (sources.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < sources.size(); i++) {
            SourceReference s = sources.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"entity_type\":\"").append(s.entityType())
              .append("\",\"entity_id\":\"").append(s.entityId())
              .append("\",\"project_name\":\"").append(s.projectName())
              .append("\",\"chunk_type\":\"").append(s.chunkType())
              .append("\"}");
        }
        sb.append("]");
        return sb.toString();
    }

    private String str(Object o) {
        return o == null ? "" : o.toString();
    }
}
