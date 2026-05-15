# Codex Marketplace

My personal Codex plugin marketplace

## Plugins

- `priogrid`: Todoist-backed weekly planning through Codex chat.

## Register Marketplace

Register this marketplace with Codex:

```bash
codex plugin marketplace add https://github.com/KiaArmani/codex-marketplace
codex plugin marketplace list
```

## Install priogrid

Install the priogrid plugin from the personal marketplace:

```bash
codex plugin install priogrid@kia
codex plugin list
```

Restart Codex if a running session has already loaded its plugin list.

## Configure priogrid

priogrid requires a Todoist API token:

```bash
export TODOIST_API_TOKEN="your-token-here"
```

Check the installation:

```bash
codex plugin run priogrid doctor
```
