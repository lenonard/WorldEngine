# WorldEngine

WorldEngine turns a semantic program description into an interactive visual graph in the browser.

The intended workflow is:

```text
Source code
   ↓
AI analysis / semantic compression
   ↓
WorldEngine IR package (.zip)
   ↓
WorldEngine web UI
   ↓
Blocks · connections · colors · notes · source references
```

The browser renderer does **not** parse programming languages. It renders a language-independent IR produced after the source has been understood.

## Current prototype

- Pure HTML/CSS/JavaScript; no build step.
- Open or drag/drop a `.zip` package.
- ZIP is read locally in the browser.
- Semantic blocks and directed connections.
- Automatic top-down layout.
- Pan, zoom and fit-to-screen.
- Node focus mode: unrelated blocks fade when a block is selected.
- Detail panel with summary, notes, source references and source snippets.
- Hierarchical `subgraph` / `group` blocks.
- Double-click a subgraph to expand/collapse it.
- Built-in sample graph.

## Run

For the simplest local test, open `index.html` in a modern browser.

You can also serve the directory with any static HTTP server, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

> ZIP support currently loads JSZip 3.10.1 from jsDelivr. The built-in sample works without opening a ZIP.

## WorldEngine ZIP format v0.1

Recommended package structure:

```text
my-analysis.zip
├── manifest.json
├── graph.json
└── source/
    ├── main.js
    └── payment.js
```

Minimal `manifest.json`:

```json
{
  "format": "worldengine-package",
  "version": "0.1",
  "graph": "graph.json",
  "sourceRoot": "source/"
}
```

Minimal `graph.json`:

```json
{
  "version": "0.1",
  "program": {
    "title": "Example",
    "summary": "What the program does",
    "language": "JavaScript",
    "entryPoint": "main()"
  },
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "label": "Start"
    },
    {
      "id": "work",
      "type": "process",
      "label": "Process input",
      "summary": "Semantic meaning of this block"
    },
    {
      "id": "done",
      "type": "return",
      "label": "Return result"
    }
  ],
  "edges": [
    { "from": "start", "to": "work" },
    { "from": "work", "to": "done" }
  ]
}
```

See [`docs/IR-v0.1.md`](docs/IR-v0.1.md) for hierarchy, source references and semantic authoring rules. A machine-readable core schema is in [`worldengine.schema.json`](worldengine.schema.json).

## Design principle

WorldEngine should show **meaning before syntax**.

A large source file should not become one giant flat flowchart. The analyzer should compress related statements into semantic steps and use nested subgraphs for large branches, functions, modules and phases. The first view should normally contain roughly 5–20 meaningful blocks, with detail available progressively.

## Repository layout

```text
index.html              App shell
styles.css              Visual system
src/zip-loader.js       Local ZIP/package reader
src/engine.js           Graph layout + renderer + interaction
src/app.js              UI wiring
src/sample-data.js      Built-in demo
worldengine.schema.json Core IR schema
docs/IR-v0.1.md         IR contract and authoring rules
```

## Next milestones

The v0.1 renderer establishes the data contract and navigation model. Natural next layers are execution traces, variable state, call stack/timeline playback, richer edge routing/bundling, and multiple views such as architecture, call graph, control flow and data flow.
