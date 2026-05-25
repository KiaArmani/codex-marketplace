---
name: repository-agents-guide
description: Create or refresh an AGENTS.md contributor guide for a repository. Use when asked to generate repository guidelines, contributor instructions, agent-specific repo guidance, or a concise AGENTS.md that documents project structure, commands, coding style, tests, commit/PR expectations, and security/configuration notes.
---

# Repository Agents Guide

## Goal

Produce a concise, repository-specific `AGENTS.md` titled `Repository Guidelines`. Prefer 200-400 words unless the user asks for more detail.

## Workflow

1. Inspect the repository before writing:
   - `pwd`, `git status --short --branch`
   - top-level files/directories
   - package/build config such as `package.json`, `pyproject.toml`, `Cargo.toml`, `Makefile`, `justfile`, `.github/workflows`
   - existing docs such as `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, previous `AGENTS.md`
2. Infer real commands from the repo. Do not invent test/build commands.
3. Summarize conventions from the files and recent git history if useful.
4. Write or update `AGENTS.md` with short, actionable sections.
5. Keep secrets and machine-local setup out of the guide except as warnings.

## Default Sections

Use these sections, adapting to the repo:

- Project Structure & Module Organization
- Build, Test, and Development Commands
- Coding Style & Naming Conventions
- Testing Guidelines
- Commit & Pull Request Guidelines
- Security & Configuration Tips, when relevant
- Agent-Specific Instructions, when the repo has special constraints

## Quality Bar

- Be specific to the repository.
- Include example commands and paths.
- Keep the tone professional and instructional.
- Avoid generic filler and broad best practices that do not map to files in the repo.
- Mention missing tests or unclear commands plainly instead of guessing.

## Validation

After writing, read the file back and check:

- The title is `Repository Guidelines`.
- The content is concise and scannable.
- Commands and paths exist or are clearly marked as examples.
- No secrets or local-only credentials are included.
