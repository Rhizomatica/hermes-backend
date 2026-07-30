# Resume Development — Hermes Backend

You are continuing development of the **Hermes Backend** project — a Node.js/TypeScript backend for HF radio communication stations.

## ⚠️ First Action (Before Writing Any Code)

Read `docs/development/progress.md` to discover:
- Which phase and branch is active
- Which tasks are complete (with commit hashes)
- Which task is marked **NEXT**
- Any blockers or notes

## Context Files (Read In This Order)

1. **`docs/development/progress.md`** — Current state, completed tasks, next task (REQUIRED)
2. **`docs/development/plan.md`** — Full task list for the current phase (reference)
3. **`docs/development/git-workflow.md`** — Branch naming, commits, PR workflow
4. **`prompts/development-prompt.md`** — Full rules & constraints (skim sections relevant to current phase)

## Your Task

1. `git checkout` the branch listed in `progress.md` (or create it if it doesn't exist yet)
2. Start implementing the task marked **NEXT**
3. Follow all rules from `prompts/development-prompt.md` (parametrized queries, no `any` types, i18n, etc.)
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/) format
5. After each completed task: **update `docs/development/progress.md`** — mark task `✅`, add commit hash, update "Next Task" pointer
6. Commit progress.md updates separately or squash into the task commit

## Session Handoff Checklist

Before ending this session, ensure `docs/development/progress.md` is:
- [ ] Updated with tasks completed this session
- [ ] Updated with the current "Next Task" pointer
- [ ] Updated with the last commit hash
- [ ] Committed and pushed to the current branch