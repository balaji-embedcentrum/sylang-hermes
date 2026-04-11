# Sylang Platform — Complete Architecture & Product Specification

**Version**: 1.0  
**Date**: 2026-04-10  
**Status**: Approved for implementation

---

## 1. What We Are Building

Sylang is a **SaaS Model-Based Systems Engineering IDE** built on top of Hermes AI agents. Users connect GitHub repos containing Sylang models, work with specialist AI agents (Requirements Engineer, Architect, Safety Engineer, Verification Engineer), and get a complete MBSE workspace in the browser.

No local install. No VS Code required. Works from any browser.

---

## 2. Infrastructure

### Machine
- **Provider**: Contabo VPS
- **RAM**: 48GB
- **CPU**: 12 cores
- **Disk**: 250GB NVMe
- **OS**: Ubuntu 22.04

### Resource Budget
```
48GB RAM
  4GB   OS + Caddy + Postgres client + sylang-hermes web app
  4GB   headroom
 40GB   agent pool (80 containers × ~500MB max active each)

250GB NVMe
  15GB  OS + Docker images + app
  20GB  80 user workspaces × 250MB quota
  10GB  logs + temp
 205GB  free headroom
```

### Capacity
- **80 concurrent specialist agents** always running
- Comfortable for 200+ registered users, 80 simultaneous active sessions
- Scale: add RAM to grow to 120+ agents without architecture change

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Web app (base) | sylang-hermes fork — TanStack Start + React 19 + Tailwind v4 |
| Agent runtime | hermes-agent (Python/aiohttp) — one container per agent slot |
| Auth | Supabase (GitHub OAuth only) |
| Database | Supabase hosted Postgres |
| File storage | VPS NVMe — `/workspaces/{user_id}/{repo}/` |
| SSL / reverse proxy | Caddy on VPS |
| Payments | Stripe |
| Push notifications | Web Push API + email |
| Editor | Monaco with Sylang language extensions |
| Diagrams | Sigma.js (port from VSCode webview) |
| Containerisation | Docker + Docker Compose |
| LLM (Sylang tier) | MiniMax / GLM (cheap, good enough) |
| LLM (BYOLLM tier) | User's own API key, proxied — agent never sees raw key |

---

## 4. Repository Structure

```
sylang-hermes/                    ← THIS repo — the web app
  src/
    routes/
      index.tsx                   ← landing page
      auth/                       ← GitHub OAuth flow
      projects.tsx                ← repo selector
      agents.tsx                  ← agent picker
      workspace.tsx               ← main IDE (files + chat + git)
      settings.tsx                ← user settings, credits, billing
      admin/                      ← admin dashboard (protected)
    server/
      assignment-service.ts       ← agent pool dispatcher (core engine)
      session-lifecycle.ts        ← start/end/timeout/crash recovery
      workspace-init.ts           ← git clone/pull, quota check
      llm-proxy.ts                ← BYOLLM proxy (user key never reaches agent)
      push-notifications.ts       ← web push + email
      stripe-webhooks.ts          ← credit top-up handler
    components/
      agent-picker/               ← availability grid, queue UI
      sylang-editor/              ← Monaco + Sylang language support
      diagram-viewer/             ← Sigma.js diagram panel
      git-panel/                  ← status, commit, push
      session-timer/              ← 3hr countdown, auto-save warning

hermes-agent/                     ← agent fork (separate repo)
  soul/
    requirements-engineer.md      ← specialist persona
    architect.md
    safety-engineer.md
    verification-engineer.md
  docker/
    Dockerfile.requirements       ← base + req soul.md
    Dockerfile.architect
    Dockerfile.safety
    Dockerfile.verification
  gateway/platforms/api_server.py ← /ws/* routes (file ops, git)
```

---

## 5. Agent Pool Design

### Pool Composition (80 total)

| Specialist | Count | Soul | Primary Sylang Types |
|---|---|---|---|
| Requirements Engineer | 20 | requirements-engineer.md | .req .blk .ifc .fun |
| Architect | 20 | architect.md | .blk .smd .seq .ucd .ifc |
| Safety Engineer | 20 | safety-engineer.md | .fta .haz .flr .sam .itm |
| Verification Engineer | 20 | verification-engineer.md | .tst .spec .req .vcf |

### Agent Personas (Named, Persistent Across Users)

Each container has a fixed name and persona baked into `soul.md`. The persona is consistent — User A and User B both get "Athena" as their Requirements Engineer, and Athena always behaves the same way. Context (what they're working on) is injected per session.

Example names: Athena, Apollo, Minerva, Hermes, Iris, Ares, Hephaestus...

### Specialisation via soul.md

```
hermes-agent container image variants:
  sylang-req:latest   ← ~/.hermes/soul.md = Requirements Engineer Athena
  sylang-arch:latest  ← ~/.hermes/soul.md = Architect Apollo
  sylang-safe:latest  ← ~/.hermes/soul.md = Safety Engineer Minerva
  sylang-vrfy:latest  ← ~/.hermes/soul.md = Verification Engineer Iris

One base Dockerfile, BUILD_ARG sets the soul. No per-request prompt injection.
```

### Sub-agents (No Extra Containers)

Hermes natively spawns sub-agents within one container. If an Architect needs to run a safety analysis mid-session, the Architect agent spawns a safety sub-agent internally. No additional container allocation, no extra credits charged.

---

## 6. Workspace Design

### Filesystem Layout

```
/workspaces/
  {supabase_user_id}/             ← owned by Linux UID, chmod 700
    {repo_name}/                  ← git checkout of user's repo
      .sylang/
        sessions/
          {session_id}.jsonl      ← full conversation log (streamed live)
          {session_id}.meta.json  ← agent_type, start, end, credits, model
        context.md                ← auto-generated running summary
        prefs.json                ← last open file, branch, editor state
      [actual repo files...]
```

### Privacy & Isolation (OS-level)

Each Supabase user is provisioned a deterministic Linux UID (10001–70000) on first signup.

```bash
# On signup:
useradd --uid 10001 --no-create-home sylang_10001
mkdir -p /workspaces/{user_id}
chown sylang_10001:sylang_10001 /workspaces/{user_id}
chmod 700 /workspaces/{user_id}
```

When an agent is assigned to a user, the container init script drops to that user's UID:
```bash
su -s /bin/bash sylang_10001
export HOME=/workspaces/{user_id}/
cd /workspaces/{user_id}/{repo}/
```

**The kernel enforces isolation.** Even if an LLM generates `cat /workspaces/other_user/secret.req`, the OS returns `Permission denied`. No application-level path checking required (though we add it as defence-in-depth).

### Quota Enforcement

- **Soft limit**: 200MB — warning shown to user
- **Hard limit**: 250MB — git clone blocked, file writes blocked
- **Check**: `du -sm /workspaces/{user_id}` before every init and write
- **Cron**: Hourly quota scan, update `workspaces.size_mb` in Postgres

### Persistent Workspaces

Workspaces survive sessions, agent crashes, and user inactivity. They are only deleted on:
- Explicit user "Delete workspace" action
- GDPR account deletion request
- 90 days of inactivity (warning email at 75 days)

### Session History Injection

On agent pickup (context packet injected before first message):
```
1. context.md        ← summary of all previous sessions on this repo
2. Last 30 messages from last session's .jsonl
3. prefs.json        ← last open file, current branch
4. git log --oneline -10  ← recent commit history
5. Workspace path: /workspaces/{user_id}/{repo}/
```

Agent feels like it "remembers" — even though it is a stateless pool container.

---

## 7. Session Lifecycle

```
User opens project → selects agent type
        ↓
Credit check: consume_credit() SQL function (atomic, row lock)
  → if 0 credits: show upgrade prompt, block session
        ↓
Assignment Service:
  1. SELECT idle agent of requested type (FOR UPDATE SKIP LOCKED)
  2. Lock row: status = 'busy', current_session = session_id
  3. Write env file: GITHUB_TOKEN, LLM key (or proxy URL)
  4. Drop container process to user UID (init script)
  5. Inject context packet
  6. Return agent internal URL to frontend
        ↓
Session active (max 3 hours)
  - Frontend sends heartbeat every 60s
  - Missed 3 heartbeats → trigger crash recovery
  - 10min warning before 3hr limit
  - Auto-save every 5min: git add -A && git commit --allow-empty
        ↓
Session ends (explicit / 20min idle / 3hr limit / crash)
  1. Final git commit: "Auto-save: session end {timestamp}"
  2. Append session summary to context.md
  3. Write {session_id}.meta.json (duration, tokens, credits)
  4. Wipe env file: truncate /root/.hermes/.env
  5. Kill hermes process, reset container to nobody UID
  6. Update Postgres: session.status = ended, agent.status = idle
  7. Notify queue (if any users waiting for this agent type)
```

### Crash Recovery

If agent container crashes mid-session:
1. Heartbeat fails 3 times (3 min)
2. Find another idle agent of same type
3. Inject context from `.sylang/sessions/{id}.jsonl` (written live, so nothing lost)
4. User sees: "Reconnecting your session..." — back online in ~10 seconds
5. Session continues, no extra credit charged

---

## 8. Credentials & Security

### GitHub Token
- Source: Supabase GitHub OAuth token (available at login, no user action needed)
- Injected into `/root/.hermes/.env` as `GITHUB_TOKEN` at session start
- Written to workspace `.git/config` for git push operations
- **Wiped from both locations at session end** (truncate env file, git config unset)

### LLM Key (BYOLLM)
- User pastes key in Settings → stored encrypted in Supabase `profiles.llm_key_enc`
- At session start: sylang-hermes decrypts and sets agent's LLM endpoint to internal proxy
- Proxy URL: `https://sylang.io/llm-proxy/{session_token}` → forwards to real API
- **Agent never sees the real API key**
- Wiped from env at session end

### LLM Key (Sylang LLM tier)
- Sylang's MiniMax/GLM key is in the Docker Compose environment
- Same proxy pattern — agent hits internal endpoint, never the real API directly

---

## 9. Billing & Credits

### Tiers

| Tier | Credits | Price | LLM |
|---|---|---|---|
| Free | 10 sessions lifetime | $0 | Sylang LLM (MiniMax/GLM) |
| Pro | 50 sessions/month | $5/month | Sylang LLM |
| Extra credits | 4 sessions | $1 | Sylang LLM |
| BYOLLM | Unlimited sessions | $0 | Your own API key |
| Sylang LLM Unlimited | 60 sessions/month | $10/month | Sylang LLM |

**Session**: max 3 hours. 1 credit consumed atomically at session start.  
**Fair use on Sylang LLM tiers**: 60 sessions/month cap. After that, buy extras.  
**BYOLLM**: No session cap. Billing is purely API cost from user's own account.

### Credit Atomicity

```sql
-- Atomic credit deduction — no double-spend possible
create or replace function consume_credit(p_user_id uuid, p_session_id uuid)
returns boolean language plpgsql as $$
declare v_credits integer;
begin
  select credits into v_credits from profiles
  where id = p_user_id for update;  -- row lock
  if v_credits < 1 then return false; end if;
  update profiles set credits = credits - 1 where id = p_user_id;
  insert into credit_transactions(user_id, delta, reason, session_id)
  values (p_user_id, -1, 'session_start', p_session_id);
  return true;
end;
$$;
```

### Stripe Integration
- Stripe Checkout for credit purchases and subscription upgrades
- Stripe webhook → `credit_transactions` insert + `profiles.credits` update
- Subscription management via Stripe Customer Portal

---

## 10. Supabase Schema

```sql
-- Extended user profile
create table profiles (
  id            uuid primary key references auth.users,
  github_login  text not null,
  github_token  text,                    -- encrypted OAuth token
  system_uid    integer unique,          -- Linux UID for workspace isolation
  credits       integer default 10,
  tier          text default 'free',     -- free | pro | byollm | sylang_llm
  llm_key_enc   text,                    -- encrypted BYOLLM API key
  stripe_id     text,                    -- Stripe customer ID
  email         text,
  push_enabled  boolean default false,
  created_at    timestamptz default now()
);

-- One workspace per user per repo
create table workspaces (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles not null,
  repo_full     text not null,           -- "owner/repo"
  repo_url      text not null,           -- clone URL
  fs_path       text not null,           -- /workspaces/{user_id}/{repo}
  size_mb       integer default 0,
  last_accessed timestamptz,
  created_at    timestamptz default now(),
  unique(user_id, repo_full)
);

-- Agent pool registry
create table agent_instances (
  id              uuid primary key default gen_random_uuid(),
  persona_name    text not null,         -- "Athena", "Apollo", "Minerva"
  specialist_type text not null,         -- requirements | architect | safety | verification
  container_name  text unique not null,  -- hermes-req-01
  internal_port   integer unique not null,-- 10001..10080
  status          text default 'idle',   -- idle | busy | error | maintenance
  current_session uuid,
  sessions_total  integer default 0,
  last_assigned   timestamptz
);

-- Sessions (core billing unit)
create table sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles not null,
  workspace_id    uuid references workspaces not null,
  agent_id        uuid references agent_instances,
  specialist_type text not null,
  persona_name    text,
  status          text default 'active', -- active | ended | timed_out | crashed
  credits_charged integer default 1,
  llm_provider    text,                  -- sylang | byollm
  llm_model       text,
  tokens_in       integer default 0,
  tokens_out      integer default 0,
  session_file    text,                  -- .sylang/sessions/{id}.jsonl
  started_at      timestamptz default now(),
  ends_at         timestamptz,           -- started_at + 3 hours
  ended_at        timestamptz
);

-- Immutable credit ledger
create table credit_transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles not null,
  delta               integer not null,  -- negative = spend, positive = purchase
  reason              text not null,     -- session_start | purchase | refund | signup_bonus
  session_id          uuid references sessions,
  stripe_payment_id   text,
  created_at          timestamptz default now()
);

-- Queue when agent type is fully busy
create table agent_queue (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles not null,
  workspace_id    uuid references workspaces not null,
  specialist_type text not null,
  status          text default 'waiting', -- waiting | notified | assigned | cancelled
  queued_at       timestamptz default now(),
  notified_at     timestamptz
);

-- Web push subscriptions
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles not null,
  endpoint    text not null,
  p256dh      text not null,
  auth_key    text not null,
  created_at  timestamptz default now()
);

-- Atomic credit deduction
create or replace function consume_credit(p_user_id uuid, p_session_id uuid)
returns boolean language plpgsql as $$
declare v_credits integer;
begin
  select credits into v_credits from profiles
  where id = p_user_id for update;
  if v_credits < 1 then return false; end if;
  update profiles set credits = credits - 1 where id = p_user_id;
  insert into credit_transactions(user_id, delta, reason, session_id)
  values (p_user_id, -1, 'session_start', p_session_id);
  return true;
end;
$$;

-- RLS policies
alter table profiles              enable row level security;
alter table workspaces            enable row level security;
alter table sessions              enable row level security;
alter table credit_transactions   enable row level security;
alter table agent_queue           enable row level security;
alter table push_subscriptions    enable row level security;

create policy "own profile"    on profiles            for all using (auth.uid() = id);
create policy "own workspaces" on workspaces          for all using (auth.uid() = user_id);
create policy "own sessions"   on sessions            for all using (auth.uid() = user_id);
create policy "own credits"    on credit_transactions for all using (auth.uid() = user_id);
create policy "own queue"      on agent_queue         for all using (auth.uid() = user_id);
create policy "own push"       on push_subscriptions  for all using (auth.uid() = user_id);
-- Agent availability is public read (users see which agents are free)
create policy "read agents"    on agent_instances     for select using (true);
```

---

## 11. Sylang Language — All 23 File Types

### What the editor handles (Monaco + syntax support)

All 23 file types get:
- Syntax highlighting (tokenisation rules from sylang-core)
- Inline validation errors (Monaco markers, powered by sylang-core parser)
- File type icon + colour in the file explorer
- Auto-save on change via `/ws/{repo}/file POST`

### What the agent handles (context-aware, no UI needed)

Anything requiring semantic understanding: generating requirements, running FTA calculations, ASIL assessments, traceability gap analysis, ASPICE compliance checks.

---

### Core Product Line Engineering

| Extension | Name | Description | Who uses it |
|---|---|---|---|
| `.ple` | Product Line Engineering | Root file. Defines the product line — name, domain, compliance standards (ISO 26262, ASPICE), ASIL level, regions. ONE per project. | Architect |
| `.fml` | Feature Model | Feature hierarchy with mandatory/optional/alternative features. Constraints between features. ONE per folder. Never manually created — right-click command. | Architect |
| `.vml` | Variant Model | Auto-generated from FML. Defines which features are selected for a variant. Multiple per folder. **Never manually edited.** | Auto-generated |
| `.vcf` | Variant Configuration | Auto-generated. Configuration values for a selected variant. ONE per folder. **Never manually edited.** | Auto-generated |

---

### Architecture & Design

| Extension | Name | Description | Who uses it |
|---|---|---|---|
| `.blk` | Block Definition | Hardware/software blocks with ports, interfaces, properties. Allocation of functions to blocks. Core architectural element. | Architect |
| `.fun` | Function Definition | Functional behavior specifications. Functions are allocated to blocks. Input/output flows, control flows. | Architect |
| `.ifc` | Interface Definition | Operations, signals, data types, parameters. Shared between blocks. Defines the contracts between components. | Architect / Req Engineer |

---

### Requirements & Testing

| Extension | Name | Description | Who uses it |
|---|---|---|---|
| `.req` | Requirement Definition | System, software, hardware requirements. Traceability via `derivedfrom`, `refinedfrom`, `implements`, `satisfies`. ASIL tagging. Full ASPICE SWE.1 support. | Requirements Engineer |
| `.tst` | Test Definition | Verification and validation tests. Links to requirements via `satisfies`. Test steps, expected results, pass criteria. ASPICE SWE.4/SWE.6 support. | Verification Engineer |
| `.spec` | Specification Document | Free-form specification documents with structured sections. Links to requirements and architecture. | Any |

---

### Behavioral Modeling (Diagrams)

| Extension | Name | Description | Diagram type |
|---|---|---|---|
| `.ucd` | Use Case Diagram | Actors and use case interactions. System boundary. Extends/includes relationships. | Sigma.js node-edge |
| `.seq` | Sequence Diagram | Message flow between components/actors over time. Activation bars, loops, alternatives. | Custom renderer |
| `.smd` | State Machine Diagram | States, transitions, guards, actions. Hierarchical states. Entry/exit actions. | Sigma.js node-edge |

---

### Safety & Reliability (ISO 26262)

| Extension | Name | Description | Who uses it |
|---|---|---|---|
| `.itm` | Item Definition | ISO 26262 item definition. System boundary, operating environment, preliminary hazard list. Entry point for safety analysis. | Safety Engineer |
| `.haz` | Hazard Analysis | Hazard analysis and risk assessment (HARA). Hazardous events, severity, exposure, controllability, ASIL. ISO 26262 Part 3. | Safety Engineer |
| `.flr` | Failure Analysis (FMEA) | Failure modes and effects analysis. Failure modes, effects, causes, detection methods, RPN. | Safety Engineer |
| `.sam` | Safety Mechanisms | Safety mechanism specifications. Links to hazards and ASIL requirements. | Safety Engineer |
| `.fta` | Fault Tree Analysis | Quantitative fault tree analysis. AND/OR gates, basic events, probability calculations. Cut sets. | Safety Engineer |

---

### Project Management

| Extension | Name | Description | Who uses it |
|---|---|---|---|
| `.spr` | Sprint Planning | Agile sprint and task management. Stories, tasks, assignments, effort estimation. ASPICE process coverage. | Any |
| `.agt` | Agent Definition | AI agent specifications. Skills, tools, constraints. Used to define custom agents within a Sylang project. | Architect |

---

### Signals & Parameters

| Extension | Name | Description | Who uses it |
|---|---|---|---|
| `.sgl` | Signal Definitions | Signal definitions with data types, ranges, units. Bus signals, CAN/LIN mappings. | Architect |
| `.spr` | System Parameter Requirements | System parameter specifications with tolerances and measurement units. | Req Engineer |

---

### Dashboard

| Extension | Name | Description |
|---|---|---|
| `.dash` | Dashboard | Custom dashboard definitions. Queries across Sylang files, charts, traceability views. The SpecDash query engine. |

---

### Key Language Concepts (All File Types)

**Traceability keywords (44 unique, 170+ composite relations):**
```
implements, satisfies, allocatedto, derivedfrom, refinedfrom,
needs, contains, realizes, verifies, traces, refines, extends,
includes, triggers, guards, constrains, ...
```

**String quoting rule (critical):** ALL property values use triple quotes `"""`.  
Single `"` breaks the TipTap editor. This is enforced by the editor.

**Import system:** `use` keyword imports symbols from other files.  
**Header:** `hdef` — ONE per file, defines the main container.  
**Symbols:** `def` — multiple per file.  
**Relations:** `ref` keyword for cross-file references.

---

## 12. Editor Features (Monaco + Sylang)

### Per-file-type in the editor

| Feature | How |
|---|---|
| Syntax highlighting | Custom Monaco tokenizer per file type (23 grammars) |
| Inline errors | Monaco markers from sylang-core parser (real-time) |
| Auto-complete | Context-aware completions for keywords, imported symbols |
| File type icon | Static map: `.req` → orange, `.blk` → blue, `.fta` → red, etc. |
| Auto-save | 800ms debounce → `/ws/{repo}/file POST` → optimistic cache |
| Format on save | Sylang formatter (indentation, triple-quote normalisation) |

### Panels alongside the editor

| Panel | Trigger | Technology |
|---|---|---|
| Diagram viewer | Opening `.ucd`, `.seq`, `.smd`, `.fta` files | Sigma.js (ported from VSCode webview) |
| Relations matrix | Button / `.dash` file | sylang-core traceability engine via API |
| FTA/FMEA results | Saving `.fta` or `.flr` file | sylang-core calculator via API |
| Git panel | Always visible | Direct `/ws/{repo}/git/*` calls |

### What the VSCode extension has that we port

- All 23 language grammars → Monaco tokenizers
- Validation engine (sylang-core) → server-side API route
- Diagram rendering (Sigma.js) → panel component
- Relations matrix → panel component
- Config-based graying (variant selection) → editor decoration

---

## 13. User Flows

### Onboarding (new user)
```
sylang.io → "Login with GitHub" → Supabase OAuth
→ Profile created (10 free credits, Linux UID provisioned)
→ /projects (empty state: "Connect your first repo")
→ GitHub repo list (user's repos via GitHub token)
→ Select repo → workspace created, git clone triggered
→ Agent picker → select specialist → session starts
→ Workspace opens
```

### Returning user
```
sylang.io → already logged in → /projects
→ Select existing project (recent repos shown first)
→ Agent picker → select specialist (see live availability)
→ Session starts (credit consumed) → workspace opens
→ Context from last session injected automatically
```

### No agent available
```
Agent picker → all Requirements Engineers busy
→ Show: "All 20 busy. Join queue? (estimated wait: 8 min)"
→ User joins queue → can browse files in read-only mode (no chat panel)
→ Push notification + in-app alert when agent is free
→ User returns, session starts
```

### Manual mode (no agent, editing only)
```
User selects project → skips agent selection
→ Workspace opens with:
  - Full file tree (WorkspaceClient → /ws/* direct calls)
  - Sylang editor (read/write)
  - Git panel (status, commit, push)
  - No chat panel
→ "Connect agent" button available if they change their mind
```

### Session ending
```
3hr timer reaches 10min warning
→ Toast: "Session ending in 10 minutes. Work is auto-saved."
→ At 3hr: final git commit, context.md updated, agent released
→ User sees: "Session ended. Start a new session to continue."
→ 1 more credit consumed for new session
```

---

## 14. Settings Page

- **Profile**: GitHub username, avatar
- **Credits**: Current balance, purchase more (Stripe Checkout)
- **Subscription**: Current tier, upgrade/downgrade
- **BYOLLM**: Paste API key (encrypted at rest), select model
- **Push notifications**: Enable/disable, test
- **Workspaces**: List all repos, see size, delete workspace
- **Account**: Delete account (GDPR — wipes workspace, anonymises sessions)

---

## 15. Admin Dashboard (Internal)

- Agent pool status grid (idle/busy/error per container)
- Force-release a stuck agent
- Active sessions (user, agent, start time, tokens used)
- User list (credits, tier, last active)
- Revenue dashboard (Stripe data)
- Block/unblock user
- Workspace quota breaches

---

## 16. Build Sequence

### Sprint 1 — Foundation
- [ ] Apply Supabase schema (SQL above)
- [ ] GitHub OAuth in sylang-hermes (replace password auth)
- [ ] Landing page (port from sylang3)
- [ ] Agent pool: Docker Compose, 80 containers, soul.md per type
- [ ] Linux UID provisioning on signup

### Sprint 2 — Assignment Engine
- [ ] Assignment Service (lock → init → env inject → UID switch → context inject)
- [ ] Session start/end/timeout lifecycle
- [ ] Credit atomic consumption
- [ ] Crash recovery (heartbeat + reassignment)
- [ ] Workspace auto-commit on session end

### Sprint 3 — User-facing Flows
- [ ] Projects dashboard (GitHub repo list)
- [ ] Agent picker UI (live availability grid)
- [ ] Queue + browser push + email notifications
- [ ] Manual mode (no agent)
- [ ] Session timer UI

### Sprint 4 — Editor & Workspace
- [ ] Monaco Sylang language extensions (23 file types)
- [ ] File type icons in hermes file explorer
- [ ] Diagram viewer panel (Sigma.js, port from VSCode)
- [ ] Relations matrix panel
- [ ] Git panel (status, commit, push)
- [ ] Workspace quota enforcement

### Sprint 5 — Billing & Settings
- [ ] Stripe integration (Checkout + webhooks + Customer Portal)
- [ ] BYOLLM proxy
- [ ] Settings page (credits, tier, LLM key, GDPR delete)
- [ ] Admin dashboard

### Sprint 6 — Productionise
- [ ] Caddy config + SSL on VPS (sylang.io)
- [ ] Final Docker Compose (web + 80 agents + reverse proxy)
- [ ] Monitoring (uptime, agent health checks)
- [ ] 90-day workspace inactivity cleanup cron
- [ ] Load test (60 concurrent sessions)

---

## 17. What We Are NOT Building

- No VS Code extension changes (existing extension works standalone)
- No per-user agent containers (pool model is correct)
- No separate containers for sub-agents (Hermes spawns internally)
- No custom WebSocket layer (Hermes SSE is sufficient)
- No file storage in S3 (VPS NVMe is faster and simpler)
- No Vercel deploy (Node server required for PTY + SSE)
- No custom git server (GitHub is the remote)
- No ISO 26262 audit log (git history is the audit trail)

---

## 18. Open Questions

- [ ] **Agent names list**: finalize 80 persona names (20 per specialist type)
- [ ] **Domain**: confirm final domain name for VPS deployment
- [ ] **Email provider**: for queue notifications (Resend / Postmark / SES)
- [ ] **Sylang LLM model**: confirm MiniMax / GLM model version and pricing
- [ ] **Free tier expiry**: do 10 free credits expire? (recommend: no expiry)
- [ ] **Team plans**: future — multiple users sharing one workspace
