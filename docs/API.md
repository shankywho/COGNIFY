# REST API & WebSocket Reference

The Cognify server exposes a REST API, Server-Sent Events (SSE) streaming, and real-time Socket.io connections.

---

## Base URLs
* **Local API Server**: `http://localhost:3000/api`
* **Realtime Sockets**: `ws://localhost:3000`

---

## API Endpoints

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Create a new user account.
* `POST /api/auth/login` — Authenticate and receive a JWT token.
* `GET /api/auth/me` — Retrieve the authenticated user profile.

### Workspaces (`/api/workspaces`)
* `GET /api/workspaces` — List workspaces accessible to the user.
* `POST /api/workspaces` — Create a new workspace.
* `GET /api/workspaces/:workspaceId` — Retrieve workspace details and member list.
* `DELETE /api/workspaces/:workspaceId` — Delete workspace and cascade-delete associated resources.

### AI Agents (`/api/agents`)
* `POST /api/agents/run` — Execute an autonomous or specialized agent task.
  * Request Body: `{ message: string, workspace_id?: string, agent_type?: string }`

### Realtime Streaming (`/api/stream`)
* `GET /api/stream?message=...&workspace_id=...` — Server-Sent Events (SSE) endpoint providing streaming LLM tokens.

### Workflows (`/api/workflows`)
* `GET /api/workflows` — List workflows for a workspace.
* `POST /api/workflows` — Create or update a workflow definition (nodes and edges).
* `POST /api/workflows/:id/run` — Enqueue a workflow run.
  * Headers: `Idempotency-Key: <unique-key>` (optional, returns cached run on duplicates)
  * Backpressure: Returns `503 Service Unavailable` with `Retry-After: 30` when queue depth exceeds `MAX_QUEUE_DEPTH`.
  * Credits: Atomically reserves 100 credits from workspace balance before enqueuing.
* `GET /api/workflows/:id/runs` — Fetch execution run history and step logs.
* `POST /api/workflows/:id/runs/:runId/retry` — Retry a failed run starting from a specific node, skipping upstream completed steps.

### Integrations & Vault (`/api/integrations`)
* `GET /api/integrations/credentials/:workspaceId` — List masked credentials (never exposes plain secrets).
* `POST /api/integrations/credentials/:workspaceId` — Upsert an AES-256-GCM encrypted credential into the vault.
* `DELETE /api/integrations/credentials/:workspaceId/:id` — Delete a credential.
* `POST /api/integrations/slack/send` — Send a message to a Slack channel.
* `POST /api/integrations/notion/pages` — Create a page in a Notion database.
* `POST /api/integrations/sheets/append` — Append rows to a Google Sheet.

### Vector Memory (`/api/memory`)
* `POST /api/memory/search` — Execute hybrid vector and full-text keyword search over document embeddings.
* `GET /api/memory/status` — Inspect workspace document ingestion status.

### Billing & Subscriptions (`/api/billing`)
* `POST /api/billing/create-checkout-session` — Create a Stripe checkout session.
* `POST /api/billing/customer-portal` — Create a Stripe customer portal session for subscription management.
* `POST /api/billing/razorpay-order` — Create a Razorpay Order for Indian UPI/Netbanking.
* `POST /api/billing/razorpay-verify` — Verify HMAC-SHA256 signature for Razorpay client-side checkouts.
* `POST /api/billing/webhook` — Stripe webhook handler with signature verification and atomic `P2002` deduplication.
* `POST /api/billing/webhook/razorpay` — Razorpay webhook handler with constant-time signature comparison and deduplication.
