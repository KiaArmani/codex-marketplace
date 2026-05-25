---
name: workflow-packaging-audit
description: Analyze recent work history to find repeated manual workflows worth turning into skills, custom subagents, or automations. Use when asked to review Codex chats, memories, Chronicle, task summaries, or activity history for recurring work; identify candidates; avoid duplicates; and create only high-confidence missing workflow assets.
---

# Workflow Packaging Audit

## Evidence Order

Use available evidence in this order:

1. Recent Codex sessions and task summaries, usually the last 30 days unless the user specifies a different window.
2. Codex memories and rollout summaries.
3. Chronicle or activity-history tools if enabled, for discovery only. Confirm important details in the relevant source system where possible.
4. Existing skills, custom agents, plugins, and automations, so new assets extend or reuse what exists.

If an expected evidence source is inaccessible, say so and continue with the remaining evidence. Do not invent cross-device evidence if a restored backup or repository cannot be unlocked.

## Candidate Test

Only package a workflow when it satisfies all of these:

- It occurred at least twice, or is clearly likely to recur and costly to repeat.
- It has stable inputs, a repeatable procedure, and a clear output or stopping condition.
- Packaging would materially improve speed, quality, consistency, or reliability.
- It is not already adequately covered by an installed skill, plugin, custom agent, or automation.

Prefer skipping over creating speculative or overlapping assets.

## Recommended Form

- **Skill**: reusable workflow/playbook that Codex should run when invoked.
- **Custom subagent**: bounded specialist role or investigation suitable for delegation.
- **Automation**: scheduled check, report, reminder, monitor, or recurring follow-up.
- **Extend existing**: the behavior belongs in an existing skill/plugin/automation.
- **Skip**: too one-off, sensitive, ambiguous, weakly evidenced, or already covered.

Use the smallest appropriate form.

## Audit Procedure

1. Establish the date window with concrete dates.
2. Inventory evidence sources and note gaps.
3. Extract compact session/task summaries: date, source/device if known, thread name, first user asks, and repeated terms.
4. Cluster the work by workflow, not by project name.
5. Compare clusters against installed skills/plugins/automations before recommending anything new.
6. Produce a compact shortlist with: repeated workflow, supporting evidence and dates, frequency/confidence, recommended form, and why it is or is not worth creating.
7. Create only high-confidence missing items. Keep each item narrow, practical, source-aware, and easy to validate.
8. Validate created skills with `quick_validate.py`; validate automations by viewing their saved config; validate repo/file assets with syntax checks when applicable.

## Output Shape

Finish with:

- What was created or extended.
- What was deliberately skipped.
- What needs more evidence before packaging.

Keep the report concise. Cite local file paths or session dates when helpful, but avoid dumping chat contents or sensitive details.
