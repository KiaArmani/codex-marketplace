---
name: codex-restic-backup
description: Set up, repair, or validate cross-device Codex chat/workspace backups using Restic over SFTP, especially to a Hetzner Storage Box. Use when asked to back up/sync Codex sessions across macOS and Windows, configure the codex-restic repo scripts, troubleshoot Restic/SFTP/Keychain/password-file failures, verify snapshots, or explain restore/analyze workflows.
---

# Codex Restic Backup

## Core Rule

Back up curated Codex data, not the whole live `~/.codex` directory. Never copy or commit secrets such as `auth.json`, real env files, private SSH keys, Restic password files, or provider tokens.

Curated Codex sources:

- macOS: `~/.codex/sessions`, `~/.codex/archived_sessions`, `~/.codex/session_index.jsonl`, `~/.codex/history.jsonl`, `~/Documents/Codex`
- Windows: `%USERPROFILE%\.codex\sessions`, `%USERPROFILE%\.codex\archived_sessions`, `%USERPROFILE%\.codex\session_index.jsonl`, `%USERPROFILE%\.codex\history.jsonl`, `%USERPROFILE%\Documents\Codex`

## Workflow

1. Locate the `codex-restic` repo from the current directory, `~/Git/codex-restic`, or a nearby `restic-codex`/`codex-restic` folder. Use its scripts instead of inventing new commands when possible.
2. Inspect repo state and ignored files. Confirm real env files are ignored before editing or committing.
3. Install Restic if missing:
   - macOS: `brew install restic`
   - Windows: `winget install --exact --id restic.restic --scope Machine`
4. Configure one repository path per device, for example `sftp://USER@HOST:23/./codex-restic/macbook` and `sftp://USER@HOST:23/./codex-restic/windows-desktop`.
5. Configure unattended SFTP auth with a dedicated OpenSSH key. Use SFTP/SSH port `23` for Hetzner Storage Box.
6. Store the Restic encryption password locally without printing it:
   - macOS: Keychain plus `RESTIC_PASSWORD_COMMAND="security find-generic-password -a $(id -un) -s restic-codex -w"` after replacing command substitution with the actual short username in env files when needed.
   - Windows: a password file under `$env:APPDATA\restic`, with ACLs restricted to the current user.
7. Run init only once per repo path. If the repo already exists, continue to backup/list/check.
8. Run backup, list snapshots, and run `check`. Treat a successful snapshot plus `check` as the stopping condition.

## Troubleshooting

- `wrong password or no key found`: the Restic encryption password does not match that repository. Do not assume all devices use the same Restic password.
- `SecKeychainSearchCopyNext`: the macOS Keychain lookup account/service does not match the saved item. Inspect with `security find-generic-password -s restic-codex` without printing `-w`.
- `Permission denied (publickey,password)`: SFTP key auth is not installed or Restic is not using the intended key. Pass `sftp.args=-i PATH -o IdentitiesOnly=yes`.
- Host key prompts: verify the Storage Box host key against Hetzner-published fingerprints before adding it to `known_hosts`.
- Repository lock conflicts: wait for the active Restic process. Use `unlock` only for stale locks.

## Validation

Use a light verification loop:

```sh
restic snapshots --tag codex
restic check
```

On Windows, run the PowerShell wrapper equivalents from the repo. If PowerShell cannot be executed on the current OS, review syntax/source and clearly say it was not executed.

## Commit Hygiene

Commit only scripts, examples, docs, and excludes. Before committing, run a secret scan over staged files and verify ignored env/password files:

```sh
git check-ignore -v codex-restic.env codex-restic.windows.env.ps1
git diff --cached --name-only
```
