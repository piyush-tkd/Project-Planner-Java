package com.portfolioplanner.ai.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class VectorStoreConfig {

    /**
     * PgVectorStore configured to use the 'ai' schema so it never
     * touches the main application's public schema.
     *
     * - dimensions=768 matches nomic-embed-text output
     * - initializeSchema=false because Flyway owns V1 migration
     */
    @Bean
    public PgVectorStore vectorStore(JdbcTemplate jdbcTemplate, EmbeddingModel embeddingModel) {
        return PgVectorStore.builder(jdbcTemplate, embeddingModel)
                .dimensions(768)
                .distanceType(PgVectorStore.PgDistanceType.COSINE_DISTANCE)
                .indexType(PgVectorStore.PgIndexType.HNSW)
                .schemaName("ai")
                .vectorTableName("vector_store")
                .initializeSchema(false)
                .build();
    }
}
