# WorldEngine

WorldEngine turns a semantic program description into an interactive visual graph in the browser.

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
   ↓
Optional execution trace · variables · call stack · animation
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
- Double-click a subgraph to expand it.
- Expanded groups remain visible as collapse chips so the parent can always be collapsed again.
- `Collapse all` appears when multiple groups are expanded.
- Light / dark theme toggle with persisted preference.
- Semantic branch colors: True/Yes/Success paths are green; False/No/Fail/Error paths are red.
- Optional execution trace playback.
- Play / pause / previous / next / reset / speed controls.
- Animated active block and transition.
- Runtime variables with changed-value highlighting.
- Call-stack inspector.
- Trace timeline slider.
- Larger runtime/detail typography for readability.
- Built-in runtime sample.

## Run

For the simplest local test, open `index.html` in a modern browser.

Recommended local server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

> ZIP support currently loads JSZip 3.10.1 from jsDelivr. The built-in sample works without opening a ZIP.

## Install once, update with Git

Instead of downloading the GitHub source ZIP after every change, clone the repository once:

```bash
git clone https://github.com/lenonard/WorldEngine.git
cd WorldEngine
```

After later updates, run only:

```bash
git pull origin main
```

If you have local changes you want to keep:

```bash
git status
git stash -u
git pull --rebase origin main
git stash pop
```

This downloads only Git changes, not a new full source ZIP every time.

## WorldEngine ZIP format v0.2

Recommended package structure:

```text
my-analysis.zip
├── manifest.json
├── graph.json
├── execution.json       # optional
└── source/
    ├── main.js
    └── payment.js
```

Minimal `manifest.json`:

```json
{
  "format": "worldengine-package",
  "version": "0.2",
  "graph": "graph.json",
  "execution": "execution.json",
  "sourceRoot": "source/"
}
```

`execution.json` is optional. v0.1 graph-only packages still render.

Minimal `graph.json`:

```json
{
  "version": "0.2",
  "program": {
    "title": "Example",
    "summary": "What the program does",
    "language": "JavaScript",
    "entryPoint": "main()"
  },
  "nodes": [
    { "id": "start", "type": "start", "label": "Start" },
    { "id": "work", "type": "process", "label": "Process input" },
    { "id": "done", "type": "return", "label": "Return result" }
  ],
  "edges": [
    { "id": "e1", "from": "start", "to": "work" },
    { "id": "e2", "from": "work", "to": "done" }
  ]
}
```

Minimal `execution.json`:

```json
{
  "trace": [
    {
      "node": "start",
      "event": "enter",
      "variablesSnapshot": true,
      "variables": { "input": 3 },
      "callStack": [{ "name": "main", "file": "source/main.js", "line": 1 }]
    },
    {
      "node": "work",
      "edge": "e1",
      "event": "process",
      "variables": { "result": 6 }
    },
    {
      "node": "done",
      "edge": "e2",
      "event": "return"
    }
  ]
}
```

See [`docs/IR-v0.2.md`](docs/IR-v0.2.md) for execution traces, variables and call stacks. The original graph contract remains documented in [`docs/IR-v0.1.md`](docs/IR-v0.1.md). A machine-readable schema is in [`worldengine.schema.json`](worldengine.schema.json).

## Design principle

WorldEngine should show **meaning before syntax**.

A large source file should not become one giant flat flowchart. The analyzer should compress related statements into semantic steps and use nested subgraphs for large branches, functions, modules and phases. The first view should normally contain roughly 5–20 meaningful blocks, with detail available progressively.

The execution trace follows the same rule: it should visualize meaningful runtime transitions, not every trivial machine-level operation.

## Logic coverage and current limits

WorldEngine v0.2 can represent normal structured control flow well: sequential work, decisions, loops/back edges, nested branches, functions/subgraphs, external calls, returns, errors, runtime variables and call stacks.

It is **not yet a universal 100% representation of every possible program behavior**. Important cases that need richer IR/view support include:

- multiple named entry/exit ports from one subgraph;
- exception propagation across several call levels;
- async/await scheduling and event-loop causality;
- callbacks, promises and event-driven flows with many possible continuations;
- threads, locks, races and true concurrent execution;
- recursion visualization beyond a simple call-stack snapshot;
- dynamic dispatch, reflection, generated code and runtime-loaded modules;
- preprocessor/macros/templates/metaprogramming where source structure differs from runtime structure;
- explicit data-flow/dependency graphs in addition to control flow;
- multiple execution scenarios and coverage comparison rather than one trace path.

The long-term goal is not to force all of these into one giant flowchart. The engine should expose multiple coordinated views (semantic control flow, call graph, data flow, execution scenarios, concurrency lanes) while keeping the first view compact.

## Repository layout

```text
index.html                    App shell
styles.css                    Base visual system
runtime.css                   Execution/runtime visuals
ui-enhancements.css           Theme, readability, branch colors, collapse controls
src/zip-loader.js             Local ZIP/package reader
src/engine.js                 Graph layout + renderer + interaction
src/execution-engine.js       Execution highlighting bridge
src/execution-player.js       Trace playback + variables + call stack
src/ui-enhancements.js        Theme toggle + semantic edges + expanded-group controls
src/app.js                    UI wiring
src/sample-data.js            Built-in runtime demo
worldengine.schema.json       IR schema
docs/IR-v0.1.md               Semantic graph contract
docs/IR-v0.2.md               Runtime execution extension
```

## Keyboard

When an execution trace is loaded:

```text
Space        Play / pause
←            Previous step
→            Next step
Esc          Pause + clear graph selection
Ctrl/Cmd + 0 Fit graph
```
