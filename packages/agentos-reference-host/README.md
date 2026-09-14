# `@mandate/agentos-reference-host`

This package contains the AgentOS host dependency closure required to reproduce Mandate's governed checkout rehearsal from the public repository:

- the Codex app-server human-approval runner;
- checksum-bound, one-request human approval relay;
- deterministic command and file-effect normalization;
- fail-closed Mandate authorization before the human gate;
- action-bound evidence publication after metered turn completion;
- the runner's environment, context, skill-lineage, process, and usage guards.

The JavaScript dependency closure was extracted from the project author's AgentOS `main` at `7a232569b812b6ea15db85b9f68989704eb629ad` during the hackathon window. This public copy additionally classifies file-move destinations before authorization and defers settlement until trusted usage arrives. It is distributed under the repository's Apache-2.0 license so the demonstration no longer depends on a private checkout. Adversarial tests cover the relay, normalization, runner ordering, and Mandate interceptor.

This is the complete source needed by the deterministic rehearsal, not the full AgentOS supervisor. The rehearsal injects a deterministic zero-model app-server fixture and exercises one file-change action. General autonomous execution remains blocked until every runtime effect and actual model usage can be intercepted and metered.
