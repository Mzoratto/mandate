CREATE TABLE IF NOT EXISTS control_plane_credentials (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  principal_id text REFERENCES principals(id),
  agent_id text REFERENCES agents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT control_plane_credentials_one_identity
    CHECK ((principal_id IS NOT NULL)::integer + (agent_id IS NOT NULL)::integer = 1)
);
CREATE INDEX IF NOT EXISTS control_plane_credentials_principal_idx
  ON control_plane_credentials (principal_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS control_plane_credentials_agent_idx
  ON control_plane_credentials (agent_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS mandate_assumption_state (
  mandate_id text NOT NULL REFERENCES mandates(id),
  key text NOT NULL,
  value_hash text NOT NULL,
  invalidates_on_change boolean NOT NULL,
  source text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (mandate_id, key)
);

ALTER TABLE execution_actions
  ADD COLUMN IF NOT EXISTS request_digest text;
UPDATE execution_actions
   SET request_digest = 'legacy:' || id
 WHERE request_digest IS NULL;
ALTER TABLE execution_actions
  ALTER COLUMN request_digest SET NOT NULL;

ALTER TABLE execution_actions
  ADD COLUMN IF NOT EXISTS settlement_digest text;

ALTER TABLE authorization_decisions
  ADD COLUMN IF NOT EXISTS amendment_suggested boolean NOT NULL DEFAULT false;

ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS execution_action_id text REFERENCES execution_actions(id);
CREATE INDEX IF NOT EXISTS evidence_execution_action_idx
  ON evidence (execution_action_id) WHERE execution_action_id IS NOT NULL;

ALTER TABLE mandate_events
  ADD COLUMN IF NOT EXISTS sequence bigint;
WITH RECURSIVE chain AS (
  SELECT id, mandate_id, event_hash, 1::bigint AS sequence
    FROM mandate_events
   WHERE previous_event_hash IS NULL
  UNION ALL
  SELECT event.id, event.mandate_id, event.event_hash, chain.sequence + 1
    FROM mandate_events AS event
    JOIN chain
      ON event.mandate_id = chain.mandate_id
     AND event.previous_event_hash = chain.event_hash
), ranked AS (
  SELECT id, sequence
    FROM chain
   WHERE id IN (SELECT id FROM mandate_events WHERE sequence IS NULL)
)
UPDATE mandate_events AS event
   SET sequence = ranked.sequence
  FROM ranked
 WHERE event.id = ranked.id;
ALTER TABLE mandate_events
  ALTER COLUMN sequence SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mandate_events_sequence_idx
  ON mandate_events (mandate_id, sequence);
