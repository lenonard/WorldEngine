# WorldEngine IR v0.3

WorldEngine IR v0.3 extends the semantic graph + runtime model with multiple coordinated program views and multiple execution scenarios.

The key idea is that no single flowchart should be forced to explain every property of a large program.

```text
Program model
├── Control Flow
├── Call Graph
├── Data Flow
├── Async / Concurrency
└── Execution Scenarios
```

Each view remains a normal WorldEngine graph (`nodes[]` + `edges[]`) so the browser renderer can reuse the same interaction model.

## Package layout

Recommended v0.3 package:

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

`manifest.json`:

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

A view entry may also be an object when metadata is useful:

```json
{
  "views": {
    "callGraph": {
      "path": "views/call-graph.json",
      "type": "call-graph",
      "title": "Call Graph",
      "description": "Important function and service calls."
    }
  }
}
```

## Backward compatibility

v0.3 remains compatible with earlier packages:

- `manifest.graph` + one `graph.json` still works;
- v0.2 `execution.json` with one `trace[]` still works;
- a package can gradually add views rather than producing all views at once.

## Control Flow

Control Flow explains **what executes next**.

Use it for:

- sequence;
- decisions;
- loops;
- return/error paths;
- nested semantic subgraphs.

Example edge:

```json
{
  "id": "branch-valid",
  "from": "valid?",
  "to": "process-payment",
  "label": "Yes",
  "relation": "true"
}
```

Use `relation: "true"` and `relation: "false"` for boolean branches so the renderer can style them semantically.

## Call Graph

Call Graph explains **who calls whom**.

Recommended node types:

- `function` for important internal functions/methods;
- `external` for services, databases, filesystem, SDKs or process boundaries.

Recommended edge type:

```json
{
  "from": "checkout",
  "to": "cardGateway",
  "type": "call"
}
```

Do not include every trivial helper when doing so makes the graph less understandable. Prefer important semantic calls.

## Data Flow

Data Flow explains **where important values come from and where they go**.

Recommended node types:

- `data` for inputs/outputs or structured datasets;
- `value` for important derived values;
- `process` for transformations.

Recommended edge type:

```json
{
  "from": "total",
  "to": "charge-provider",
  "type": "data-flow"
}
```

Data Flow is deliberately different from Control Flow. An edge means a dependency/transfer of information, not necessarily the next executed statement.

## Async / Concurrency

Async / Concurrency explains **tasks, waits, resume points and parallel relationships**.

Recommended node types:

- `async` — async execution context;
- `await` — suspension/wait point;
- `task` — asynchronous task/job;
- `thread` / `worker` — parallel execution unit;
- `external` — async external operation.

Recommended edge types include:

```text
async
concurrent
spawn
await
resume
join
message
```

The first implementation renders these as a graph. Future iterations can add lane/timeline layouts for true parallel execution.

## Multiple execution scenarios

`scenarios.json`:

```json
{
  "scenarios": [
    {
      "id": "happy-path",
      "title": "Successful card checkout",
      "view": "controlFlow",
      "trace": [
        { "node": "start", "event": "enter" },
        { "node": "validate", "event": "process" },
        { "node": "valid", "event": "branch" },
        { "node": "payment", "event": "process" },
        { "node": "done", "event": "return" }
      ]
    },
    {
      "id": "validation-error",
      "title": "Validation failure",
      "view": "controlFlow",
      "trace": [
        { "node": "start", "event": "enter" },
        { "node": "validate", "event": "process" },
        { "node": "valid", "event": "branch" },
        { "node": "reject", "event": "return" }
      ]
    }
  ]
}
```

Selecting a scenario resets playback and switches to its declared view when needed.

Scenarios are especially useful because a static graph shows **possible logic**, while a trace shows **one concrete path through that logic**.

## Cross-view identity

Where possible, analyzers should use stable semantic IDs or metadata linking related concepts across views.

Example:

```json
{
  "id": "payment-call",
  "type": "function",
  "label": "processPayment()",
  "metadata": {
    "semanticId": "payment-processing"
  }
}
```

A Control Flow subgraph and a Call Graph function may share the same `metadata.semanticId` even if their visual node IDs differ.

This prepares WorldEngine for synchronized focus between views in a later v0.3 iteration.

## What v0.3 solves

v0.3 separates concerns that become unreadable when forced into one graph:

- control ordering;
- function/service structure;
- data dependencies;
- async/concurrent relationships;
- concrete runtime paths.

It does **not** claim complete concurrency semantics yet. Locks, race conditions, scheduling, channels, distributed messaging and happens-before relationships will need richer concurrency metadata and specialized layouts.
