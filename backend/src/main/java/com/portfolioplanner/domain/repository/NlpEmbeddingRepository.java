package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NlpEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NlpEmbeddingRepository extends JpaRepository<NlpEmbedding, Long> {

    /**
     * Semantic nearest-neighbor search using cosine distance.
     * Returns the top-K most similar embeddings to the query vector.
     * Lower cosine distance = more similar (0 = identical, 2 = opposite).
     */
    @Query(value = """
            SELECT e.id, e.entity_type, e.entity_id, e.entity_name, e.content_text,
                   e.intent, e.route, e.metadata, e.source, e.confidence,
                   e.active, e.created_at, e.updated_at,
                   (e.embedding <=> cast(:queryVector as vector)) AS distance
            FROM nlp_embedding e
            WHERE e.active = true
            ORDER BY e.embedding <=> cast(:queryVector as vector)
            LIMIT :topK
            """, nativeQuery = true)
    List<Object[]> findNearestNeighbors(@Param("queryVector") String queryVector,
                                         @Param("topK") int topK);

    /**
     * Semantic search filtered by entity types.
     */
    @Query(value = """
            SELECT e.id, e.entity_type, e.entity_id, e.entity_name, e.content_text,
                   e.intent, e.route, e.metadata, e.source, e.confidence,
                   e.active, e.created_at, e.updated_at,
                   (e.embedding <=> cast(:queryVector as vector)) AS distance
            FROM nlp_embedding e
            WHERE e.active = true
              AND e.entity_type = ANY(cast(:types as varchar[]))
            ORDER BY e.embedding <=> cast(:queryVector as vector)
            LIMIT :topK
            """, nativeQuery = true)
    List<Object[]> findNearestByTypes(@Param("queryVector") String queryVector,
                                       @Param("types") String types,
                                       @Param("topK") int topK);

    /**
     * Semantic search for query patterns only (used for intent resolution).
     */
    @Query(value = """
            SELECT e.id, e.entity_type, e.entity_id, e.entity_name, e.content_text,
                   e.intent, e.route, e.metadata, e.source, e.confidence,
                   e.active, e.created_at, e.updated_at,
                   (e.embedding <=> cast(:queryVector as vector)) AS distance
            FROM nlp_embedding e
            WHERE e.active = true
              AND e.entity_type = 'QUERY_PATTERN'
              AND e.intent IS NOT NULL
            ORDER BY e.embedding <=> cast(:queryVector as vector)
            LIMIT :topK
            """, nativeQuery = true)
    List<Object[]> findNearestQueryPatterns(@Param("queryVector") String queryVector,
                                             @Param("topK") int topK);

    /**
     * Insert an embedding with the vector column via native SQL.
     */
    @Modifying
    @Query(value = """
            INSERT INTO nlp_embedding (entity_type, entity_id, entity_name, content_text,
                                        embedding, intent, route, metadata, source, confidence, active)
            VALUES (:entityType, :entityId, :entityName, :contentText,
                    cast(:embedding as vector), :intent, :route, cast(:metadata as jsonb),
                    :source, :confidence, :active)
            """, nativeQuery = true)
    void insertWithVector(@Param("entityType") String entityType,
                          @Param("entityId") Long entityId,
                          @Param("entityName") String entityName,
                          @Param("contentText") String contentText,
                          @Param("embedding") String embedding,
                          @Param("intent") String intent,
                          @Param("route") String route,
                          @Param("metadata") String metadata,
                          @Param("source") String source,
                          @Param("confidence") double confidence,
                          @Param("active") boolean active);

    /**
     * Update the embedding vector for an existing row.
     */
    @Modifying
    @Query(value = """
            UPDATE nlp_embedding
            SET embedding = cast(:embedding as vector),
                content_text = :contentText,
                metadata = cast(:metadata as jsonb),
                updated_at = NOW()
            WHERE id = :id
            """, nativeQuery = true)
    void updateVector(@Param("id") Long id,
                      @Param("contentText") String contentText,
                      @Param("embedding") String embedding,
                      @Param("metadata") String metadata);

    /** Find by entity type and entity ID (for upsert logic). */
    List<NlpEmbedding> findByEntityTypeAndEntityId(String entityType, Long entityId);

    /** Find by entity type (for bulk operations). */
    List<NlpEmbedding> findByEntityType(String entityType);

    /** Count active embeddings by type. */
    @Query("SELECT e.entityType, COUNT(e) FROM NlpEmbedding e WHERE e.active = true GROUP BY e.entityType")
    List<Object[]> countByEntityType();

    /** Delete all embeddings for a given entity type (for full re-sync). */
    @Modifying
    @Query("DELETE FROM NlpEmbedding e WHERE e.entityType = :entityType")
    void deleteByEntityType(@Param("entityType") String entityType);

    /** Deactivate stale embeddings not updated since a given time. */
    @Modifying
    @Query("UPDATE NlpEmbedding e SET e.active = false WHERE e.entityType = :entityType AND e.updatedAt < :before")
    void deactivateStale(@Param("entityType") String entityType,
                         @Param("before") java.time.LocalDateTime before);
}
