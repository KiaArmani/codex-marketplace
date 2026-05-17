---
name: diataxis
description: Write, review, classify, restructure, or improve technical documentation using the Diataxis framework. Use when Codex needs to create tutorials, how-to guides, reference documentation, explanations, documentation information architecture, documentation review feedback, or migrations that separate mixed documentation by user need.
---

# Diataxis

## Overview

Use Diataxis to match each documentation page to the reader need it serves. Keep the four modes distinct: tutorials teach through a guided learning experience, how-to guides help competent users accomplish work, reference describes facts, and explanation builds understanding.

## Workflow

1. Identify the user's immediate documentation task: draft, rewrite, classify, review, restructure, or plan.
2. Work at the smallest useful scope first: a sentence, section, page, or small group of pages. Avoid imposing a complete four-part structure before the content calls for it.
3. Classify the content with the compass:

| Content serves | User's situation | Mode |
| --- | --- | --- |
| action | acquiring skill through study | tutorial |
| action | applying skill to work | how-to guide |
| cognition | applying skill to work | reference |
| cognition | acquiring skill through study | explanation |

4. Choose one primary mode for each page. If a page mixes modes, preserve useful content but move, split, shorten, or link off-mode material instead of blending it into the main flow.
5. Apply the mode rules below. Prefer concrete edits over abstract diagnosis.
6. When organizing a documentation set, let structure emerge from real pages and user needs. Do not create empty `tutorials/`, `how-to/`, `reference/`, or `explanation/` sections just to match the framework.

## Mode Rules

### Tutorials

Write a tutorial as a lesson.

- Provide a safe, guided path for a learner.
- Give the learner something meaningful and achievable to complete.
- Keep steps small, concrete, and end-to-end.
- Remove unnecessary choices, abstractions, and reference detail.
- Minimize explanation inside the tutorial; link to deeper explanation when needed.
- Optimize for confidence, successful completion, and useful exposure to core concepts, not production completeness.

### How-To Guides

Write a how-to guide as practical directions for competent users.

- Start from a real-world goal, task, or problem.
- Assume the reader knows the domain well enough to work.
- Focus on action and judgment that help the user get the work done.
- Omit teaching, conceptual digressions, and exhaustive option lists.
- Use a logical sequence, but allow branches or decision points when real work requires them.
- Title the page as a task, usually `How to ...`.

### Reference

Write reference as neutral technical description.

- State accurate facts about the product, API, command, schema, configuration, or behavior.
- Mirror the structure of the thing being described whenever that helps users locate facts.
- Use consistent patterns for parameters, defaults, return values, constraints, examples, errors, and warnings.
- Provide examples only to illustrate usage, not to teach a lesson or guide a task.
- Remove opinion, background discussion, and procedural walkthroughs unless they are necessary statements of correct use.

### Explanation

Write explanation as bounded discussion that deepens understanding.

- Answer why, why not, how concepts relate, and what tradeoffs matter.
- Provide context, background, design reasoning, alternatives, analogies, and implications.
- Admit perspective or opinion when it clarifies judgment.
- Keep the topic bounded; move instructions to how-to guides and facts to reference.
- Make connections to tutorials, how-to guides, and reference pages when those links help the reader continue.

## Task Patterns

### Drafting New Documentation

Ask or infer the intended reader, their situation, and the page's primary mode. Produce the requested document in that mode, then add only the cross-links or short notes needed to keep adjacent modes available without polluting the page.

### Revising Existing Documentation

Preserve correct facts and useful material. Identify the primary mode, remove mode conflicts, and relocate or link content that belongs elsewhere. If editing files, keep changes scoped to the requested documentation.

### Reviewing Documentation

Lead with concrete findings:

- State the likely mode and the user need being served.
- Point out mode conflicts, missing reader context, misplaced facts or explanations, and title mismatches.
- Suggest specific moves, deletions, rewrites, or new pages.
- Use file and line references when available.

### Restructuring Documentation Sets

Inventory existing pages by user need before proposing navigation. Prefer incremental moves and renamed pages over a large rewrite. Group pages by what users are trying to learn, do, look up, or understand; add redirects or links when users may arrive through older paths.

## Final Check

Before finishing, verify:

- The page has one dominant Diataxis mode.
- The title matches the mode and user need.
- Tutorial content teaches through guided action.
- How-to content helps competent users accomplish a real task.
- Reference content is accurate, structured, and neutral.
- Explanation content is bounded and answers why or how ideas connect.
- Cross-links replace duplicated or misplaced material.
