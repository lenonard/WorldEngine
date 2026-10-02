# WorldEngine IR v0.2

WorldEngine IR v0.2 keeps the semantic graph model from v0.1 and adds optional execution playback: trace steps, variable state and call stack snapshots.

## Package layout

Recommended package:

```text
analysis.zip
├── manifest.json
├── graph.json
├── execution.json
└── source/
    └── ... selected source files
```

`execution.json` is optional. A package without it still renders as a static semantic graph.

`manifest.json`:

```json
{
  "format": "worldengine-package",
  "version": "0.2",
  "graph": "graph.json",
  "execution": "execution.json",
  "sourceRoot": "source/"
}
```

The renderer also accepts execution data embedded directly in `graph.json` under `execution`.

## Semantic graph

Nodes and edges keep the v0.1 contract. The analyzer should continue to optimize for comprehension rather than statement-by-statement completeness.

A large source base should normally show about 5–20 meaningful blocks on the first screen, with deeper logic represented by nested `subgraph` / `group` nodes.

### Decision branch semantics

For decision edges, prefer an explicit semantic `relation` instead of relying only on a human-readable label:

```json
{
  "id": "valid-yes",
  "from": "valid",
  "to": "process",
  "label": "Yes",
  "relation": "true"
}
```

```json
{
  "id": "valid-no",
  "from": "valid",
  "to": "reject",
  "label": "No",
  "relation": "false"
}
```

The renderer uses these semantics for immediate visual recognition:

- `relation: "true"` → green branch;
- `relation: "false"` → red branch.

For compatibility, common labels such as `True`, `False`, `Yes`, `No`, `Success`, `Fail`, `Valid` and `Invalid` are also recognized, but generated WorldEngine packages should prefer explicit `relation` values.

## Execution object

Minimal `execution.json`:

```json
{
  "id": "example-run",
  "title": "Example execution",
  "trace": [
    {
      "node": "start",
      "event": "enter",
      "variablesSnapshot": true,
      "variables": {
        "input": 3
      },
      "callStack": [
        { "name": "main", "file": "source/main.js", "line": 1 }
      ]
    },
    {
      "node": "work",
      "edge": "e1",
      "event": "process",
      "variables": {
        "result": 6
      }
    },
    {
      "node": "done",
      "edge": "e2",
      "event": "return"
    }
  ]
}
```

## Trace step fields

A trace step may contain:

| Field | Meaning |
| --- | --- |
| `node` | Semantic node currently executing |
| `edge` | Edge used to arrive at this step, if the edge has an ID |
| `event` | `enter`, `process`, `branch`, `call`, `return`, `error`, or another descriptive event |
| `label` | Short human-readable title for this step |
| `message` / `note` | Explanation shown in the runtime panel |
| `variables` | Variable updates applied on top of previous runtime state |
| `variablesSnapshot` | When `true`, clear previous variable state before applying `variables` |
| `variablesRemoved` | Variable names removed at this step |
| `callStack` | Full call-stack snapshot for this step |

### Variables are incremental by default

`variables` is treated as a patch unless `variablesSnapshot: true` is present.

Example:

```json
[
  {
    "node": "start",
    "variablesSnapshot": true,
    "variables": { "i": 0, "sum": 0 }
  },
  {
    "node": "loop",
    "variables": { "i": 1, "sum": 10 }
  }
]
```

At the second step the visible state is:

```json
{ "i": 1, "sum": 10 }
```

This makes large traces smaller than repeating every unchanged variable at every step.

### Removing variables

```json
{
  "node": "return",
  "variablesRemoved": ["temporaryBuffer"]
}
```

## Call stack

A call stack is a full snapshot. Frames are ordered from caller to current frame.

```json
{
  "callStack": [
    { "name": "checkout", "file": "source/checkout.js", "line": 15 },
    { "name": "cardGateway.charge", "line": 1 }
  ]
}
```

A frame may also be a simple string:

```json
{
  "callStack": ["main", "parse", "evaluate"]
}
```

## Runtime visualization rules

The renderer:

1. highlights the currently executing semantic block;
2. animates the transition from the previous block to the active block;
3. marks blocks already visited in the current trace;
4. shows changed variables with stronger visual emphasis;
5. shows the call stack for the current step;
6. lets the user play, pause, reset, step backward/forward and scrub the trace timeline.

If an executing child node belongs to a collapsed subgraph, the renderer highlights the collapsed parent block. If the user expands that subgraph, the active child becomes visible without changing the trace position.

## Trace authoring guidance

The trace should explain execution at the same semantic level as the graph. Do not emit a runtime step for every machine instruction or trivial source statement unless that detail is needed to understand the algorithm.

Prefer steps such as:

```text
Validate order
   ↓
Branch: valid
   ↓
Call payment provider
   ↓
Persist transaction
   ↓
Return result
```

instead of dozens of assignments with no explanatory value.

## Compatibility

- v0.1 graph packages continue to render.
- `execution.json` is optional.
- Unknown fields remain tolerated for forward compatibility.
- Source coordinates still belong in source references, not layout coordinates.
