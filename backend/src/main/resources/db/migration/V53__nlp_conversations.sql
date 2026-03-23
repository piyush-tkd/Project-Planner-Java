-- Conversation threads for multi-turn NLP chat
CREATE TABLE nlp_conversation (
    id                 BIGSERIAL PRIMARY KEY,
    title              VARCHAR(255),          -- auto-generated from first message
    username           VARCHAR(100) NOT NULL,
    is_pinned          BOOLEAN DEFAULT false,
    message_count      INTEGER DEFAULT 0,
    last_message_at    TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT now(),
    updated_at         TIMESTAMP NOT NULL DEFAULT now()
);

-- Individual messages in a conversation
CREATE TABLE nlp_conversation_message (
    id                 BIGSERIAL PRIMARY KEY,
    conversation_id    BIGINT NOT NULL REFERENCES nlp_conversation(id) ON DELETE CASCADE,
    role               VARCHAR(20) NOT NULL,   -- 'user' or 'assistant'
    content            TEXT NOT NULL,           -- the message text
    intent             VARCHAR(50),            -- detected intent (for assistant messages)
    confidence         DOUBLE PRECISION,       -- confidence score
    resolved_by        VARCHAR(50),            -- which strategy resolved it
    response_data      TEXT,                   -- JSON blob of structured response data (route, formData, data, drillDown)
    suggestions        TEXT,                   -- JSON array of follow-up suggestions
    tool_calls         TEXT,                   -- JSON array of tool calls made
    response_ms        INTEGER,               -- response time in ms
    created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_nlp_conv_username ON nlp_conversation(username);
CREATE INDEX idx_nlp_conv_msg_conv_id ON nlp_conversation_message(conversation_id);
CREATE INDEX idx_nlp_conv_updated ON nlp_conversation(updated_at DESC);
