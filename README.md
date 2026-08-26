# Herdr Replay

Record multi-agent coding sessions as inspectable, shareable timelines. Herdr Replay captures Herdr lifecycle changes and redacted terminal evidence first; Git status and commits are optional enrichment rather than a requirement.

## Features

- Records agent discovery, working, blocked, idle, done, and closed transitions.
- Captures terminal evidence only when a pane changes.
- Redacts common tokens, API keys, passwords, and bearer credentials.
- Adds branch, worktree, changed-file, and commit context when Git is available.
- Produces portable `.herdr-replay.json` and self-contained `latest.html` files.
- Runs locally without telemetry, accounts, databases, or runtime dependencies.

## Install

```bash
herdr plugin install neospeed83/herdr-replay
herdr server reload-config
```

## Use

```bash
herdr plugin action invoke herdr-replay.start
# Work normally in Herdr.
herdr plugin action invoke herdr-replay.stop
herdr plugin action invoke herdr-replay.export
herdr plugin pane open --plugin herdr-replay --entrypoint viewer
```

The stop and export actions print the exact paths to the generated JSON and HTML files. Reports live in Herdr's local plugin state directory.

## Privacy

Recordings can contain source code and terminal output. Built-in redaction is defense in depth, not a guarantee. Review a replay before sharing it publicly.

## Requirements

- Herdr 0.8.0+
- Node.js 20+

## License

MIT — see [LICENSE](LICENSE).
