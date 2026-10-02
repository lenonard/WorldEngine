# WorldEngine

WorldEngine turns a semantic program description into an interactive visual model in the browser.

```text
Source code
   ↓
AI analysis / semantic compression
   ↓
WorldEngine IR package (.zip)
   ↓
WorldEngine web UI
   ├── Control Flow
   ├── Call Graph
   ├── Data Flow
   ├── Async / Concurrency
   └── Execution Scenarios
```

The browser renderer does **not** parse programming languages. It renders a language-independent IR produced after the source has been understood.

## Current prototype

- Pure HTML/CSS/JavaScript; no build step.
- Open or drag/drop a `.zip` package locally in the browser.
- Semantic blocks, directed connections, colors, notes and source references.
- Automatic layout, pan, zoom and fit-to-screen.
- Hierarchical `subgraph` / `group` blocks.
- Double-click a subgraph to expand it.
- Expanded groups expose dedicated collapse chips; multiple open groups can be collapsed together.
- Light / dark theme with persisted preference.
- Semantic branch colors: true/success paths green, false/error paths red.
- Execution trace playback with variables, call stack, timeline and animated active transitions.
- Larger runtime/detail typography.
- WorldEngine v0.3 multi-view navigation: Control Flow, Call Graph, Data Flow and Async / Concurrency.
- Multiple named execution scenarios in one package.
- Built-in v0.3 sample with four views and several scenarios.

## Run

Recommended local server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

> ZIP support loads JSZip 3.10.1 from jsDelivr. The built-in sample can be explored immediately with **Load sample**.

## Install once, update with Git

Clone once:

```bash
git clone https://github.com/lenonard/WorldEngine.git
cd WorldEngine
```

After later updates:

```bash
git pull origin main
```

If you have local changes:

```bash
git status
git stash -u
git pull --rebase origin main
git stash pop
```

## WorldEngine ZIP format v0.3

Recommended structure:

```text
analysis.zip
├── manifest.json
├── views/
│   ├── control-flow.json
│   ├── call-graph.json
│   ├── data-flow.json
│   └── async.json
├── scenarios.json
└── source/
    └── ...
```

Example `manifest.json`:

```json
{
  "format": "worldengine-package",
  "version": "0.3",
  "defaultView": "controlFlow",
  "defaultScenario": "happy-path",
  "views": {
    "controlFlow": "views/control-flow.json",
    "callGraph": "views/call-graph.json",
    "dataFlow": "views/data-flow.json",
    "async": "views/async.json"
  },
  "scenarios": "scenarios.json",
  "sourceRoot": "source/"
}
```

v0.3 remains backward-compatible with earlier graph-only and single-trace packages.

See:

- [`docs/IR-v0.1.md`](docs/IR-v0.1.md) — semantic graph contract
- [`docs/IR-v0.2.md`](docs/IR-v0.2.md) — execution trace, variables and call stack
- [`docs/IR-v0.3.md`](docs/IR-v0.3.md) — multi-view program model and multiple scenarios

## Design principle

WorldEngine shows **meaning before syntax**.

A large source base should not become one giant flat flowchart. The analyzer should compress related statements into semantic steps and use nested subgraphs for deeper logic. The first Control Flow screen should normally expose roughly 5–20 meaningful blocks.

v0.3 also avoids forcing every type of program relationship into Control Flow:

- **Control Flow** — what executes next;
- **Call Graph** — who calls whom;
- **Data Flow** — where important values come from and go;
- **Async / Concurrency** — tasks, waits, resumes and parallel relationships;
- **Execution Scenarios** — concrete runtime paths through possible logic.

## Logic coverage and current limits

Structured application logic is represented well, including sequence, decisions, loops/back edges, nested branches, functions/subgraphs, external calls, returns, errors, runtime variables and call stacks.

WorldEngine still does **not** claim a mathematically complete representation of every possible program behavior. Areas that need richer semantics/layouts include:

- named multiple entry/exit ports on complex subgraphs;
- exception propagation across call levels;
- event-loop causality and complex callback/promise graphs;
- true concurrency scheduling, locks, channels, races and happens-before relationships;
- recursive call-tree visualization;
- dynamic dispatch, reflection and runtime-loaded code;
- generated/macros/templates where source and runtime structure diverge;
- synchronized cross-view focus and coverage comparison across scenarios.

The v0.3 Async / Concurrency view is intentionally a semantic graph foundation. Specialized lane/timeline layouts will be needed for deep concurrent analysis.

## Repository layout

```text
index.html                         App shell
styles.css                         Base visual system
runtime.css                        Execution/runtime visuals
ui-enhancements.css                Theme, readability and branch colors
multiview.css                      Multi-view tabs and view-specific styles
scenario.css                       Scenario selector styles
src/zip-loader.js                  v0.1–v0.3 ZIP/package reader
src/engine.js                      Graph layout + renderer + interaction
src/execution-engine.js            Runtime highlighting bridge
src/execution-player.js            Trace playback + variables + call stack
src/ui-enhancements.js             Theme + semantic edges + collapse controls
src/multiview.js                   v0.3 view controller
src/scenario-enhancements.js       Multiple execution scenarios
src/sample-data.js                 Base runtime demo
src/sample-v03.js                  Four-view / multi-scenario demo extension
src/app.js                         UI wiring
docs/IR-v0.3.md                    v0.3 contract
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
