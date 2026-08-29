# Herdr Replay

Record multi-agent coding sessions as inspectable, shareable timelines. Herdr Replay captures Herdr lifecycle changes and redacted terminal evidence first; Git status and commits are optional enrichment rather than a requirement.

## Features

- Records agent discovery, working, blocked, idle, done, and closed transitions.
- Captures terminal evidence only when a pane changes.
- Redacts common tokens, API keys, passwords, and bearer credentials.
- Adds branch, worktree, changed-file, and commit context when Git is available.
- Produces portable `.herdr-replay.json` and self-contained `latest.html` files.
- Runs locally without telemetry, accounts, databases, or runtime dependencies.
- Installs one shortcut: `prefix+f` toggles recording and opens the replay when stopping.
- Records only the active workspace by default and archives every session.

## Install

```bash
herdr plugin install neospeed83/herdr-replay
herdr server reload-config
```

The installer safely adds `prefix+f` to Herdr's config and creates `config.toml.bak-herdr-replay` before its first edit. It refuses to overwrite a conflict.

## Use

Press `Ctrl+B`, release, then press `F` to start recording the current workspace. Press the same shortcut again to stop, archive, export, and open the replay.

CLI actions remain available:

```bash
herdr plugin action invoke herdr-replay.start
herdr plugin action invoke herdr-replay.stop
herdr plugin action invoke herdr-replay.open
```

The stop and export actions print the exact paths to the generated JSON and HTML files. Reports live in Herdr's local plugin state directory.

## Privacy

Recordings can contain source code and terminal output. Built-in redaction is defense in depth, not a guarantee. Review a replay before sharing it publicly.

## Runtime

Herdr Replay is a native Rust plugin. Installation downloads the matching prebuilt binary; Node.js and Rust are not required.

## Requirements

- Herdr 0.8.0+

## Uninstall

```bash
herdr plugin action invoke herdr-replay.remove-keybinding
herdr plugin uninstall herdr-replay
herdr server reload-config
```

## License

MIT — see [LICENSE](LICENSE).
