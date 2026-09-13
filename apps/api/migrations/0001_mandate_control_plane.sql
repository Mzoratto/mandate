DO $$ BEGIN
  CREATE TYPE principal_type AS ENUM ('human', 'organization', 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE runtime_type AS ENUM ('agentos', 'strands', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mandate_status AS ENUM (
    'DRAFT', 'PROPOSED', 'AWAITING_APPROVAL', 'ACTIVE', 'SUSPENDED',
    'AMENDMENT_PENDING', 'COMPLETED', 'REJECTED', 'REVOKED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE amendment_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE conformance_decision AS ENUM ('ALLOW', 'DENY', 'ESCALATE', 'INVALIDATE_APPROVAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS principals (
  id text PRIMARY KEY,
  type principal_type NOT NULL,
  tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  runtime runtime_type NOT NULL,
  instance_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mandates (
  id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES principals(id),
  subject_id text NOT NULL REFERENCES agents(id),
  current_version integer NOT NULL,
  status mandate_status NOT NULL,
  created_at timestamptz NOT NULL,
  approved_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS mandates_principal_status_idx ON mandates (principal_id, status);

CREATE TABLE IF NOT EXISTS mandate_versions (
  mandate_id text NOT NULL REFERENCES mandates(id),
  version integer NOT NULL,
  content jsonb NOT NULL,
  content_digest text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (mandate_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS mandate_versions_digest_idx ON mandate_versions (mandate_id, content_digest);

CREATE TABLE IF NOT EXISTS mandate_approvals (
  id text PRIMARY KEY,
  mandate_id text NOT NULL,
  mandate_version integer NOT NULL,
  version_digest text NOT NULL,
  principal_id text NOT NULL REFERENCES principals(id),
  assumption_hashes jsonb NOT NULL,
  nonce text NOT NULL,
  approved_at timestamptz NOT NULL,
  supersedes_approval_id text,
  FOREIGN KEY (mandate_id, mandate_version) REFERENCES mandate_versions(mandate_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS approvals_replay_guard_idx
  ON mandate_approvals (principal_id, mandate_id, mandate_version, nonce);

CREATE TABLE IF NOT EXISTS mandate_amendments (
  id text PRIMARY KEY,
  mandate_id text NOT NULL REFERENCES mandates(id),
  base_version integer NOT NULL,
  base_version_digest text NOT NULL,
  proposal jsonb NOT NULL,
  status amendment_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text REFERENCES principals(id)
);
CREATE INDEX IF NOT EXISTS amendments_attention_idx ON mandate_amendments (mandate_id, status);

CREATE TABLE IF NOT EXISTS executions (
  id text PRIMARY KEY,
  mandate_id text NOT NULL,
  mandate_version integer NOT NULL,
  subject_id text NOT NULL REFERENCES agents(id),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  monetary_spent_micro_usd bigint NOT NULL DEFAULT 0,
  tokens_used bigint NOT NULL DEFAULT 0,
  mutation_actions integer NOT NULL DEFAULT 0,
  external_call_actions integer NOT NULL DEFAULT 0,
  delegation_depth integer NOT NULL DEFAULT 0,
  FOREIGN KEY (mandate_id, mandate_version) REFERENCES mandate_versions(mandate_id, version)
);

CREATE TABLE IF NOT EXISTS execution_actions (
  id text PRIMARY KEY,
  execution_id text NOT NULL REFERENCES executions(id),
  tool text NOT NULL,
  operation text NOT NULL,
  inputs jsonb NOT NULL,
  status text NOT NULL,
  proposed_at timestamptz NOT NULL,
  executed_at timestamptz
);
CREATE INDEX IF NOT EXISTS execution_actions_execution_idx ON execution_actions (execution_id, proposed_at);

CREATE TABLE IF NOT EXISTS execution_effects (
  id text PRIMARY KEY,
  action_id text NOT NULL REFERENCES execution_actions(id),
  type text NOT NULL,
  resources jsonb NOT NULL,
  environment text,
  reversible boolean NOT NULL,
  confidence numeric(4, 3) NOT NULL,
  estimated_cost_micro_usd bigint
);
CREATE INDEX IF NOT EXISTS execution_effects_action_idx ON execution_effects (action_id);

CREATE TABLE IF NOT EXISTS authorization_decisions (
  id text PRIMARY KEY,
  action_id text NOT NULL REFERENCES execution_actions(id),
  decision conformance_decision NOT NULL,
  reasons jsonb NOT NULL,
  violated_rules jsonb NOT NULL,
  mandate_version_digest text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS authorization_decisions_action_idx ON authorization_decisions (action_id);

CREATE TABLE IF NOT EXISTS delegations (
  parent_mandate_id text NOT NULL REFERENCES mandates(id),
  child_mandate_id text NOT NULL REFERENCES mandates(id),
  parent_version integer NOT NULL,
  child_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (parent_mandate_id, child_mandate_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id text PRIMARY KEY,
  mandate_id text NOT NULL,
  mandate_version integer NOT NULL,
  requirement_id text,
  type text NOT NULL,
  producer text NOT NULL,
  artifact_uri text,
  digest text,
  verified boolean NOT NULL DEFAULT false,
  verified_by text,
  created_at timestamptz NOT NULL,
  FOREIGN KEY (mandate_id, mandate_version) REFERENCES mandate_versions(mandate_id, version)
);
CREATE INDEX IF NOT EXISTS evidence_mandate_idx ON evidence (mandate_id, mandate_version);

CREATE TABLE IF NOT EXISTS criterion_results (
  id text PRIMARY KEY,
  mandate_id text NOT NULL,
  mandate_version integer NOT NULL,
  criterion_id text NOT NULL,
  status text NOT NULL,
  verifier text NOT NULL,
  evidence_ids jsonb NOT NULL,
  verified_at timestamptz NOT NULL,
  FOREIGN KEY (mandate_id, mandate_version) REFERENCES mandate_versions(mandate_id, version)
);
CREATE INDEX IF NOT EXISTS criterion_results_latest_idx
  ON criterion_results (mandate_id, mandate_version, criterion_id, verified_at);

CREATE TABLE IF NOT EXISTS mandate_events (
  id text PRIMARY KEY,
  mandate_id text NOT NULL REFERENCES mandates(id),
  mandate_version integer NOT NULL,
  type text NOT NULL,
  actor text NOT NULL,
  payload jsonb NOT NULL,
  timestamp timestamptz NOT NULL,
  previous_event_hash text,
  event_hash text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS mandate_events_timeline_idx ON mandate_events (mandate_id, timestamp);
