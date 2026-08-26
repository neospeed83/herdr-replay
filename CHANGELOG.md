# Changelog

## [0.2.2] - 2026-08-26

- Prevent Git changed-file arrays from overwriting the displayed agent status.
- Keep long terminal lines intact with horizontal scrolling.
- Use the available viewport instead of leaving a large empty area.
- Display recording dates in the viewer's local format.

## [0.2.1] - 2026-08-26

- Capture and deduplicate terminal output continuously instead of relying on pane metadata revisions.
- Open replays at the latest meaningful state rather than an empty starting frame.
- Reworked the layout for bounded terminal output, clearer evidence labels, and readable short recordings.
- Escaped event content before rendering it into HTML.

## [0.2.0] - 2026-08-26

- Added `prefix+f` one-key recording toggle with safe automatic setup.
- Record only the invoking workspace by default.
- Archive every recording with workspace name and timestamp.
- Automatically open the interactive replay when toggle stops recording.
- Added explicit open and keybinding-cleanup actions.

## [0.1.0] - 2026-08-26

- Initial Herdr lifecycle recorder.
- Redacted terminal evidence and optional Git enrichment.
- Portable JSON recording and self-contained interactive HTML replay.
