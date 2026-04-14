package com.portfolioplanner.ai.api.dto;

/**
 * A single chunk that contributed to an AI answer.
 * Surfaced in the UI "Sources" panel so users can verify the answer.
 */
public record SourceReference(
        String entityType,    // e.g. "PROJECT"
        String entityId,      // e.g. "42"
        String projectName,   // e.g. "Project Atlas"
        String chunkType      // e.g. "RISKS" | "CORE" | "MILESTONES" | "TEAM"
) {}
