# DocuMind AI — Architectural & Technical Decisions (DECISIONS.md)

This file tracks all explicit architectural decisions, design choices, and environment determinations made for DocuMind according to the Master Build Specification.

---

### 1. Vector Search & Embeddings
- **Embedding Model**: `nomic-embed-text` served via local Ollama (`http://localhost:11434/api/embeddings`).
- **Embedding Dimensions**: **768** (verified by live invocation on Ollama).
- **Atlas Vector Search Configuration**:
  - Index Name: `chunk_vector_index` on collection `chunks`.
  - Dimension: `768`, Similarity: `cosine`.
  - Indexed Filter Fields: `orgId`, `documentId`, `folderId`.
- **Tenant Isolation in Vector Search**: MongoDB Atlas `$vectorSearch` requires exact `ObjectId` types for ID fields. All queries explicitly cast `orgId` via `new mongoose.Types.ObjectId(req.user.orgId)`.

---

### 2. LLM & Ollama Configuration
- **Model**: `llama3.2` (REST at `http://localhost:11434/api/generate`).
- **Prompt Isolation**: System prompts strictly specify JSON-only output and instruct the model that document text constitutes untrusted data, never instructions.
- **Fail-safe Parsing & Retries**: All LLM outputs are validated against a dynamic Zod schema generated from the document's template. On validation failure, the extraction is retried once. If it fails a second time, all fields default to `null` with a `0.0` confidence score, flagging the document for human review without worker termination.

---

### 3. Queue Architecture & Resilience
- **Primary Queue**: BullMQ + Redis on `127.0.0.1:6379`.
- **Resilient Fallback**: A socket pre-check tests Redis connectivity before attempting BullMQ operations. If Redis is unavailable or disconnected, an asynchronous background tick (`setImmediate`) handles the pipeline worker tasks so the server continues running smoothly without crashing.

---

### 4. Template & Validation Engine (Document-Type Agnostic)
- **Zero Hardcoding**: Core code contains no invoice-specific, student-specific, or medical-specific field logic.
- **Storage**: Fields, labels, data types (`string`, `number`, `date`, `boolean`, `list`, `table`), and validation rules are stored completely in MongoDB `templates` per organization.
- **Validation Rules**: Evaluated dynamically by `src/services/validate.js`. Rule types:
  - `required`, `regex`, `number_range`, `date_order`, `table_sum_equals`, `sum_of_fields_equals`, `unique_in_org`.
- **Issue Severities**: Validation failures produce structured issues `{ field, rule, message, severity }` displayed in the human review interface.

---

### 5. Multi-Tenancy & Security
- **Tenant Isolation**: Every database collection (`organizations`, `users`, `folders`, `templates`, `documents`, `documentpages`, `extractions`, `chunks`, `summaries`, `conversations`, `auditlogs`, `reports`) includes `orgId`.
- **JWT Authentication**: `orgId`, `id`, and `role` are embedded in the verified JWT payload and extracted by `auth.js` middleware. Queries reject or ignore request body overrides of `orgId`.
- **Role-Based Access Control (RBAC)**:
  - `admin`: Full administrative control, user management, template authoring, audit log access.
  - `employee`: Upload, view, search, chat, summarize, export, manage own uploads.
  - `reviewer`: Upload, view, correct extracted data, approve documents, export.
  - `viewer` (read-only): View documents, extracted data, search, and chat.

---

### 6. UI & Design System (iOS-Premium & Fast)
- **Glassmorphism Scope**: Applied exclusively to navigation chrome and overlays (top navbar, sidebar, modals, action sheets, dropdown menus, toasts, chat input).
- **Solid Surfaces**: Content tables, document viewer, extraction grids, and forms use solid backgrounds (`#FFFFFF` in light mode, `#1C1C1E` in dark mode) for maximum rendering performance and zero frame drops.
- **Tokens**: Stored in `client/src/styles/tokens.css` with native Apple system font stack (`-apple-system`, `Inter`, `system-ui`), standard iOS system colors (`#007AFF`, `#34C759`, `#FF9500`, `#FF3B30`, `#5856D6`), and 8px grid spacing.
- **Lite Mode**: Automatically activated on weak devices (`navigator.hardwareConcurrency <= 4` or `navigator.deviceMemory <= 4`) or via manual toggle in Settings, removing all backdrop blur filters for instant performance.
