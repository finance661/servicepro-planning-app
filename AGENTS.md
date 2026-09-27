# ServicePro agent instructions

These instructions apply to the entire repository. Every agent must read this file before changing files, configuration, data models, or infrastructure.

## Fixed system roles

| System | Role | Use it for |
|---|---|---|
| Google Drive | Workspace | Source documents, drafts, exports, research, attachments, and temporary working files |
| GitHub | Source of truth | Code, configuration, agent state, decisions, tests, and deployment definitions |
| Cloudflare | Execution | Builds, previews, production, bindings, databases, storage, routes, and runtime secrets |

Drive is not the final source for code or configuration. Cloudflare is not the source of truth. Every lasting technical change must be represented in GitHub.

## Required reading order

1. Read AGENTS.md.
2. Read .agent/PROJECT_STATE.yaml.
3. Read .agent/STATE_MACHINE.md.
4. Inspect the current branch, recent commits, and uncommitted changes.
5. Open only Drive sources named by the task or provided through an authorized connection.
6. Before deployment, identify the exact GitHub commit that Cloudflare will execute.

## Working rules

- Work from the repository; use Drive for inputs and temporary outputs.
- Record lasting decisions, assumptions, and configuration in GitHub.
- Update .agent/PROJECT_STATE.yaml in the same change whenever project state changes.
- For normal development, use a branch named agent/<short-task-name>.
- Keep commits small, descriptive, and traceable.
- Never store tokens, passwords, private Drive URLs, account identifiers, or API keys in this public repository.
- Use Cloudflare Secret Store or another approved secret provider for secrets.
- Treat main as the production source unless PROJECT_STATE.yaml explicitly says otherwise.
- A Cloudflare deployment becomes LIVE only after its URL, health, and deployed commit are verified.
- Record the deployed commit in execution.deployed_commit.
- Do not leave a lasting production-only change outside GitHub. After emergency recovery, represent the same change in GitHub immediately.
- Do not delete or overwrite Drive source material without an explicit request.

## State machine

Normal flow:

INBOX -> DISCOVERY -> WORKING -> REVIEW -> READY -> DEPLOYING -> LIVE

Exception states:

- BLOCKED: required access, information, or a decision is missing.
- FAILED: a check, build, or deployment failed.
- ROLLBACK: production is being restored to the last known good commit.

An agent may advance only when the exit criteria in .agent/STATE_MACHINE.md are satisfied.

## Resolving conflicts

- GitHub wins for code, configuration, decisions, and agent state.
- Drive supplies working input; final technical output must be committed to GitHub.
- Cloudflare shows what is actually running. If it differs from GitHub, set the state to BLOCKED or FAILED, identify the deployed commit, and restore alignment.
- Never silently choose between conflicting sources. Record the conflict and next action in PROJECT_STATE.yaml.

## Bootstrapping new projects

Every new ServicePro repository must start with:

- a root AGENTS.md;
- .agent/STATE_MACHINE.md;
- .agent/PROJECT_STATE.yaml;
- a private reference to its Drive workspace outside a public repository;
- a declared Cloudflare target before production is enabled.
