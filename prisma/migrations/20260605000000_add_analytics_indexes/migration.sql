CREATE INDEX IF NOT EXISTS "chats_user_id_created_at_idx"
ON "chats"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "usage_logs_user_id_model_created_at_idx"
ON "usage_logs"("user_id", "model", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "usage_logs_user_id_chat_id_created_at_idx"
ON "usage_logs"("user_id", "chat_id", "created_at" DESC);
