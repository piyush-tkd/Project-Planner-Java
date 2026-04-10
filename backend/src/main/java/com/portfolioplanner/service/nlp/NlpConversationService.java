package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.domain.model.NlpConversation;
import com.portfolioplanner.domain.model.NlpConversationMessage;
import com.portfolioplanner.domain.repository.NlpConversationMessageRepository;
import com.portfolioplanner.domain.repository.NlpConversationRepository;
import com.portfolioplanner.dto.response.NlpConversationResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service for managing multi-turn NLP conversations.
 * Handles conversation lifecycle, message history, and context building for the NLP engine.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NlpConversationService {

    private final NlpConversationRepository conversationRepo;
    private final NlpConversationMessageRepository messageRepo;
    private final NlpService nlpService;
    private final ObjectMapper objectMapper;

    /** Maximum number of previous messages to include in conversation context. */
    private static final int CONTEXT_MESSAGE_LIMIT = 10;

    /**
     * List all conversations for a user, ordered by most recent first.
     */
    @Transactional(readOnly = true)
    public List<NlpConversationResponse> listConversations(String username) {
        List<NlpConversation> conversations = conversationRepo.findByUsernameOrderByUpdatedAtDesc(username);
        return conversations.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get a single conversation with all its messages.
     */
    @Transactional(readOnly = true)
    public NlpConversationResponse getConversation(Long conversationId, String username) {
        NlpConversation conversation = conversationRepo.findByIdAndUsername(conversationId, username)
                .orElseThrow(() -> new RuntimeException("Conversation not found or access denied"));

        List<NlpConversationMessage> messages = messageRepo.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<NlpConversationResponse.MessageResponse> messageResponses = messages.stream()
                .map(this::toMessageResponse)
                .collect(Collectors.toList());

        return new NlpConversationResponse(
                conversation.getId(),
                conversation.getTitle(),
                conversation.isPinned(),
                conversation.getMessageCount(),
                conversation.getLastMessageAt(),
                conversation.getCreatedAt(),
                messageResponses
        );
    }

    /**
     * Create a new conversation.
     * If title is not provided, it will be generated from the first message sent.
     */
    @Transactional
    public NlpConversationResponse createConversation(String username, String title) {
        NlpConversation conversation = new NlpConversation();
        conversation.setUsername(username);
        conversation.setTitle(title != null ? title : "[New Conversation]");
        conversation.setPinned(false);
        conversation.setMessageCount(0);

        NlpConversation saved = conversationRepo.save(conversation);
        log.info("Created new conversation {} for user {}", saved.getId(), username);

        return toResponse(saved);
    }

    /**
     * Send a message in a conversation.
     * Saves the user message, processes it through the NLP engine with conversation context,
     * saves the assistant response, and updates conversation metadata.
     */
    @Transactional
    public NlpConversationResponse.MessageResponse sendMessage(Long conversationId, String username,
                                                               String messageText, Long userId) {
        NlpConversation conversation = conversationRepo.findByIdAndUsername(conversationId, username)
                .orElseThrow(() -> new RuntimeException("Conversation not found or access denied"));

        // Save user message
        NlpConversationMessage userMessage = new NlpConversationMessage();
        userMessage.setConversationId(conversationId);
        userMessage.setRole("user");
        userMessage.setContent(messageText);
        messageRepo.save(userMessage);

        // Build context from previous messages (last N messages)
        String conversationContext = buildConversationContext(conversationId);

        // Process the message through NLP engine with context
        long startTime = System.currentTimeMillis();
        NlpQueryResponse nlpResponse = nlpService.queryWithContext(messageText, conversationContext, userId);
        int responseMs = (int) (System.currentTimeMillis() - startTime);

        // Save assistant response
        NlpConversationMessage assistantMessage = new NlpConversationMessage();
        assistantMessage.setConversationId(conversationId);
        assistantMessage.setRole("assistant");
        assistantMessage.setContent(nlpResponse.response() != null && nlpResponse.response().message() != null
                ? nlpResponse.response().message()
                : "I couldn't process your message.");
        assistantMessage.setIntent(nlpResponse.intent());
        assistantMessage.setConfidence(nlpResponse.confidence());
        assistantMessage.setResolvedBy(nlpResponse.resolvedBy());
        assistantMessage.setResponseMs(responseMs);

        // Serialize response payload to JSON
        if (nlpResponse.response() != null) {
            try {
                assistantMessage.setResponseData(objectMapper.writeValueAsString(nlpResponse.response()));
            } catch (Exception e) {
                log.warn("Failed to serialize response data: {}", e.getMessage());
            }
        }

        // Serialize suggestions
        if (nlpResponse.suggestions() != null && !nlpResponse.suggestions().isEmpty()) {
            try {
                assistantMessage.setSuggestions(objectMapper.writeValueAsString(nlpResponse.suggestions()));
            } catch (Exception e) {
                log.warn("Failed to serialize suggestions: {}", e.getMessage());
            }
        }

        NlpConversationMessage savedAssistantMessage = messageRepo.save(assistantMessage);

        // Update conversation metadata and save context
        conversation.setMessageCount(conversation.getMessageCount() + 2);  // user + assistant
        conversation.setLastMessageAt(Instant.now());
        // Auto-title from first message if still default
        if ("[New Conversation]".equals(conversation.getTitle())) {
            conversation.setTitle(generateTitle(messageText));
        }

        // Serialize session context to JSON for persistence
        String contextJson = serializeSessionContext(conversationId);
        conversation.setContextJson(contextJson);

        conversationRepo.save(conversation);

        log.info("Sent message in conversation {} for user {}: intent={} resolvedBy={}",
                conversationId, username, nlpResponse.intent(), nlpResponse.resolvedBy());

        return toMessageResponse(savedAssistantMessage);
    }

    /**
     * Delete a conversation (and all its messages via cascade).
     */
    @Transactional
    public void deleteConversation(Long conversationId, String username) {
        NlpConversation conversation = conversationRepo.findByIdAndUsername(conversationId, username)
                .orElseThrow(() -> new RuntimeException("Conversation not found or access denied"));

        conversationRepo.delete(conversation);
        log.info("Deleted conversation {} for user {}", conversationId, username);
    }

    /**
     * Pin or unpin a conversation.
     */
    @Transactional
    public void togglePin(Long conversationId, String username) {
        NlpConversation conversation = conversationRepo.findByIdAndUsername(conversationId, username)
                .orElseThrow(() -> new RuntimeException("Conversation not found or access denied"));

        conversation.setPinned(!conversation.isPinned());
        conversationRepo.save(conversation);
        log.info("Toggled pin for conversation {} (isPinned={})", conversationId, conversation.isPinned());
    }

    /**
     * Get conversation context JSON for restoring session memory.
     */
    @Transactional(readOnly = true)
    public java.util.Optional<String> getContext(Long conversationId, String username) {
        return conversationRepo.findByIdAndUsername(conversationId, username)
                .map(NlpConversation::getContextJson);
    }

    /**
     * Build conversation context from the last N messages.
     * Formats as: "Previous conversation:\nUser: ...\nAssistant: ...\n..."
     */
    private String buildConversationContext(Long conversationId) {
        List<NlpConversationMessage> messages = messageRepo.findByConversationIdOrderByCreatedAtAsc(conversationId);

        if (messages.isEmpty()) {
            return "";
        }

        // Take last N messages (excluding the current user message which will be added later)
        List<NlpConversationMessage> contextMessages = messages.stream()
                .skip(Math.max(0, messages.size() - CONTEXT_MESSAGE_LIMIT))
                .collect(Collectors.toList());

        if (contextMessages.isEmpty()) {
            return "";
        }

        StringBuilder context = new StringBuilder("Previous conversation:\n");
        for (NlpConversationMessage msg : contextMessages) {
            String role = "user".equals(msg.getRole()) ? "User" : "Assistant";
            context.append(role).append(": ").append(msg.getContent()).append("\n");
        }

        return context.toString();
    }

    /**
     * Serialize conversation messages to JSON context array.
     * Format: [ { "q": "...", "a": "...", "intent": "..." }, ... ]
     */
    private String serializeSessionContext(Long conversationId) {
        List<NlpConversationMessage> messages = messageRepo.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<Map<String, Object>> contextArray = new ArrayList<>();

        for (int i = 0; i < messages.size(); i += 2) {
            if (i + 1 < messages.size()) {
                NlpConversationMessage userMsg = messages.get(i);
                NlpConversationMessage assistantMsg = messages.get(i + 1);

                if ("user".equals(userMsg.getRole()) && "assistant".equals(assistantMsg.getRole())) {
                    Map<String, Object> item = new java.util.LinkedHashMap<>();
                    item.put("q", userMsg.getContent());
                    item.put("a", assistantMsg.getContent());
                    item.put("intent", assistantMsg.getIntent());
                    contextArray.add(item);
                }
            }
        }

        try {
            return objectMapper.writeValueAsString(contextArray);
        } catch (Exception e) {
            log.warn("Failed to serialize session context: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Generate a title from the first message (take first ~50 chars or first sentence).
     */
    private String generateTitle(String message) {
        if (message == null || message.isBlank()) {
            return "[New Conversation]";
        }

        String trimmed = message.trim();

        // Find first sentence boundary
        int endIndex = trimmed.indexOf('.');
        if (endIndex == -1) {
            endIndex = trimmed.indexOf('?');
        }
        if (endIndex == -1) {
            endIndex = trimmed.indexOf('!');
        }

        // Use sentence if found and reasonable, otherwise use first 50 chars
        if (endIndex > 0 && endIndex < 100) {
            return trimmed.substring(0, endIndex);
        }

        return trimmed.length() > 50 ? trimmed.substring(0, 50) + "..." : trimmed;
    }

    /**
     * Convert entity to response DTO (without messages).
     */
    private NlpConversationResponse toResponse(NlpConversation conversation) {
        return new NlpConversationResponse(
                conversation.getId(),
                conversation.getTitle(),
                conversation.isPinned(),
                conversation.getMessageCount(),
                conversation.getLastMessageAt(),
                conversation.getCreatedAt(),
                null  // Messages only populated in getConversation
        );
    }

    /**
     * Convert message entity to response DTO.
     */
    private NlpConversationResponse.MessageResponse toMessageResponse(NlpConversationMessage message) {
        // Deserialize response data from JSON
        NlpQueryResponse.NlpResponsePayload responsePayload = null;
        if (message.getResponseData() != null && !message.getResponseData().isBlank()) {
            try {
                responsePayload = objectMapper.readValue(message.getResponseData(),
                        NlpQueryResponse.NlpResponsePayload.class);
            } catch (Exception e) {
                log.warn("Failed to deserialize response data: {}", e.getMessage());
            }
        }

        // Deserialize suggestions from JSON
        List<String> suggestions = new ArrayList<>();
        if (message.getSuggestions() != null && !message.getSuggestions().isBlank()) {
            try {
                suggestions = objectMapper.readValue(message.getSuggestions(),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            } catch (Exception e) {
                log.warn("Failed to deserialize suggestions: {}", e.getMessage());
            }
        }

        return new NlpConversationResponse.MessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getIntent(),
                message.getConfidence(),
                message.getResolvedBy(),
                responsePayload,
                suggestions,
                message.getResponseMs(),
                message.getCreatedAt()
        );
    }
}
