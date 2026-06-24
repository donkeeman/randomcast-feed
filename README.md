# RandomCast Feed

This directory is the tracked feed consumed by the Android app.

- `index.json`: The episode list consumed by the app.
- `episodes/YYYY-MM-DD-morning.json`: A dated slot episode.
- `episodes/YYYY-MM-DD-evening.json`: A dated slot episode.

Claude Routine should update the slot files and `index.json` after validating generated episodes with `routine/validate-episode.mjs`.
