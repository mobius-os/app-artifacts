# Artifacts

Artifacts is the Möbius catalog for interactive HTML pages, visualizations, and polished documents created by the in-product agent. It gives owners one place to browse their artifacts, preview or inspect each version, copy or download its HTML, return to the originating chat, and publish a stable public snapshot.

Artifacts ships an always-on prompt fragment that nudges the agent to offer visuals when they would help.

## What it does

- Polls the app storage catalog while visible and reflects agent-created records without a reload.
- Runs self-contained HTML in an opaque nested iframe with scripts and popups, but no same-origin access.
- Shows immutable version history and lets the owner preview or view the source of any recorded version.
- Copies selected-version HTML as plain text and downloads it with an explicit scripts warning.
- Resolves origin chat titles through the redacted chat-log summary permission.
- Stages a selected version through Möbius publishing, tracks its stable public URL, updates it on demand, and unpublishes it.
- Handles `/shell/?app=artifacts&intent=artifact:<id>` intents and provides chat handoffs in both directions.

## Storage contract

```text
artifacts/<artifact_id>.json
versions/<artifact_id>/v<N>.html
shares/<artifact_id>.json
projects/<artifact_id>/build/site/index.html
```

Artifact records and version files are agent-owned. Share records and publish staging are app-owned, so no file has competing writers.

## Development

The app is a source-only Möbius mini-app. `index.jsx` is the composition entry, `domain.js` contains pure record/version/share logic, `storage.js` owns runtime and HTTP integration, `theme.js` contains the scoped `af-` stylesheet, and feature UI lives under `ui/` and `preview/`.

Run the unit tests:

```bash
npm test
```

The platform bundles `index.jsx` with esbuild as one ESM module and supplies React and `date-fns` through the Möbius import map.

## License

MIT
