CREATE TABLE IF NOT EXISTS mcp_work_requests (
  principal_id text NOT NULL REFERENCES principals(id),
  idempotency_key text NOT NULL,
  request_digest text NOT NULL,
  mandate_id text NOT NULL UNIQUE REFERENCES mandates(id),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (principal_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS mcp_work_requests_mandate_idx
  ON mcp_work_requests (mandate_id);

CREATE TABLE IF NOT EXISTS approval_challenges (
  id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES principals(id),
  mandate_id text NOT NULL,
  mandate_version integer NOT NULL,
  subject_kind text NOT NULL CHECK (subject_kind IN ('mandate', 'action', 'amendment')),
  subject_id text NOT NULL,
  subject_digest text NOT NULL,
  nonce_hash text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('mcp-app', 'external-review')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  decision text CHECK (decision IN ('APPROVE', 'REJECT', 'SUPERSEDED')),
  FOREIGN KEY (mandate_id, mandate_version) REFERENCES mandate_versions(mandate_id, version),
  CHECK ((consumed_at IS NULL AND decision IS NULL) OR (consumed_at IS NOT NULL AND decision IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS approval_challenges_pending_idx
  ON approval_challenges (principal_id, mandate_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS oauth_subjects (
  authorization_server text NOT NULL,
  subject text NOT NULL,
  principal_id text NOT NULL REFERENCES principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (authorization_server, subject)
);

CREATE INDEX IF NOT EXISTS oauth_subjects_principal_idx
  ON oauth_subjects (principal_id);
