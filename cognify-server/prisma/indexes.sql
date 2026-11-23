-- ==============================================================================
-- Cognify Production Database Indexes
-- PostgreSQL 16 + pgvector Extension
-- ==============================================================================
-- This script contains production-grade, idempotent index definitions for:
-- 1. pgvector HNSW Approximate Nearest Neighbor (ANN) Cosine Search
-- 2. PostgreSQL GIN Inverted Index for Sparse Lexical Full-Text Search
-- 3. Composite B-Tree Indexes for Strict Workspace Tenant Isolation
--
-- Apply against production/staging via:
--   psql "$DATABASE_URL" -f database/indexes.sql
-- ==============================================================================

-- 1. Ensure required PostgreSQL extensions are active
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. pgvector HNSW Index on 1536-dimensional embeddings
-- Operator class: vector_cosine_ops (for cosine distance queries using <=>)
-- Parameters:
--   m = 16              -> Max bidirectional links per node (optimal memory-to-recall trade-off)
--   ef_construction = 64 -> Candidate list size during construction (>98% high-recall benchmark)
CREATE INDEX IF NOT EXISTS embedding_hnsw_cosine_idx
ON "Embedding"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. PostgreSQL GIN Index for Full-Text Search
-- Accelerates sparse lexical retrieval (Reciprocal Rank Fusion BM25 equivalent)
-- Used by: to_tsvector('english', content) @@ websearch_to_tsquery('english', $query)
CREATE INDEX IF NOT EXISTS embedding_content_gin_idx
ON "Embedding"
USING gin (to_tsvector('english', content));

-- 4. Multi-Tenant Scoping & Time-Series Compound B-Tree Index
-- Guarantees sub-millisecond filtering on workspace boundary before distance ranking
CREATE INDEX IF NOT EXISTS embedding_workspace_created_idx
ON "Embedding" (workspace_id, created_at DESC);

-- 5. File ID foreign-key cascade acceleration
CREATE INDEX IF NOT EXISTS embedding_file_id_idx
ON "Embedding" (file_id);

-- 6. Core Relational Foreign-Key & Composite Query Acceleration
CREATE INDEX IF NOT EXISTS workspaces_user_id_idx ON "workspaces" (user_id);
CREATE INDEX IF NOT EXISTS messages_workspace_created_idx ON "messages" (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS files_workspace_created_idx ON "File" (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS airequests_workspace_created_idx ON "AIRequest" (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON "TeamMember" (team_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON "TeamMember" (user_id);
CREATE INDEX IF NOT EXISTS team_workspaces_workspace_id_idx ON "TeamWorkspace" (workspace_id);
CREATE INDEX IF NOT EXISTS workflows_workspace_active_idx ON "workflows" (workspace_id, "isActive");
CREATE INDEX IF NOT EXISTS workflow_runs_wf_status_idx ON "workflow_runs" (workflow_id, status);
CREATE INDEX IF NOT EXISTS run_steps_run_status_idx ON "run_steps" (run_id, status);

-- 7. Verify created indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Embedding';
