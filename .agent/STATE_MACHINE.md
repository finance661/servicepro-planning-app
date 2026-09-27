# ServicePro project state machine

This state machine keeps Google Drive, GitHub, and Cloudflare aligned.

## States

| State | Meaning | Exit criterion |
|---|---|---|
| INBOX | Work request received | Goal, owner, and intended result are known |
| DISCOVERY | Sources and current state are checked | Relevant Drive input, repository state, and execution target are identified |
| WORKING | The change is being built | Code and documentation are updated |
| REVIEW | The change is being checked | Relevant checks are complete and results are recorded |
| READY | The change is ready to execute | Target commit and deployment plan are known |
| DEPLOYING | Cloudflare is executing the target commit | Build and deployment have started |
| LIVE | The change is running and verified | URL, health, and commit match |
| BLOCKED | Access, information, or a decision is missing | Blocker is resolved and recorded |
| FAILED | A check, build, or deployment failed | Cause and recovery action are identified |
| ROLLBACK | The last known good version is being restored | Recovery commit is running and verified |

## Allowed transitions

- INBOX -> DISCOVERY
- DISCOVERY -> WORKING
- DISCOVERY -> BLOCKED
- WORKING -> REVIEW
- WORKING -> BLOCKED
- REVIEW -> WORKING
- REVIEW -> READY
- REVIEW -> FAILED
- READY -> DEPLOYING
- READY -> BLOCKED
- DEPLOYING -> LIVE
- DEPLOYING -> FAILED
- FAILED -> WORKING
- FAILED -> ROLLBACK
- ROLLBACK -> LIVE
- BLOCKED -> DISCOVERY
- BLOCKED -> WORKING
- LIVE -> INBOX

## Required transition data

Update .agent/PROJECT_STATE.yaml with:

- status;
- updated_at;
- current.goal;
- current.next_action;
- current.blockers;
- non-sensitive references to required work sources;
- source.last_verified_commit;
- for execution: execution.deployed_commit, URL, and result.

## Deployment verification

A project may become LIVE only when:

1. the deployed commit exists in GitHub;
2. the build belongs to that commit;
3. Cloudflare reports a successful deployment;
4. the production URL responds;
5. a targeted functional check succeeds;
6. the project state is updated.

If a running Cloudflare version cannot be linked to GitHub, the state is BLOCKED.
