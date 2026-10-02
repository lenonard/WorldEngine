# WorldEngine IR v0.1

WorldEngine IR is a language-independent semantic graph. It is the contract between source-code analysis and the browser renderer.

## 1. Package layout

Recommended ZIP layout:

```text
analysis.zip
├── manifest.json
├── graph.json
└── source/
    └── ... original or selected source files
```

`manifest.json`:

```json
{
  "format": "worldengine-package",
  "version": "0.1",
  "graph": "graph.json",
  "sourceRoot": "source/"
}
```

The renderer also accepts a ZIP containing only one `graph.json` or `worldengine.json` file.

## 2. Core philosophy

The IR describes **semantic steps**, not syntax nodes.

Do not create a visual block for every statement simply because a parser can. Group consecutive statements when they serve one understandable purpose.

Bad:

```text
[id = user.id]
      ↓
[name = user.name]
      ↓
[age = user.age]
```

Preferred:

```text
[Prepare user data]
```

The detailed code remains available through `source` or `code`.

### First-view target

For a large source base, the default graph should normally expose about 5–20 meaningful blocks. Deeper logic belongs in nested `subgraph` nodes.

## 3. Program metadata

```json
{
  "program": {
    "id": "checkout-service",
    "title": "Checkout service",
    "summary": "Validates an order, charges payment and persists the transaction.",
    "language": "TypeScript",
    "entryPoint": "checkout()"
  }
}
```

`program.summary` should explain intent, not restate a filename or function signature.

## 4. Nodes

Required fields:

```json
{
  "id": "validate-order",
  "type": "process",
  "label": "Validate order"
}
```

Recommended fields:

```json
{
  "id": "validate-order",
  "type": "process",
  "label": "Validate order",
  "summary": "Checks business constraints and calculates the payable total.",
  "notes": [
    "Four low-level checks are intentionally compressed into this semantic step."
  ],
  "source": {
    "file": "source/checkout.ts",
    "startLine": 20,
    "endLine": 37
  }
}
```

### Known node types

| Type | Meaning |
| --- | --- |
| `start` | Entry to a flow |
| `process` | Normal semantic work |
| `decision` | Branch / condition |
| `subgraph` | Collapsible nested flow |
| `group` | Generic semantic container |
| `call` | Important internal call |
| `external` | External service/API/database boundary |
| `return` | Return/result |
| `error` | Error/rejection/failure path |
| `end` | Terminal flow end |

The renderer tolerates additional node types and will fall back to process styling.

## 5. Edges

Minimal:

```json
{ "from": "validate", "to": "decision" }
```

Conditional edge:

```json
{ "from": "decision", "to": "success", "label": "Yes" }
```

Loop/back edge:

```json
{
  "from": "increment",
  "to": "condition",
  "type": "back",
  "label": "next item"
}
```

Use `type: "back"`, `type: "loop"`, `relation: "back"`, or `relation: "loop"` for edges that return to an earlier step. This helps layout avoid treating the loop as forward progression.

## 6. Hierarchy and subgraphs

Large branches, functions, phases and modules should be represented as nested graphs.

Collapsed parent:

```json
{
  "id": "payment",
  "type": "subgraph",
  "label": "Process payment",
  "summary": "Select provider, charge and normalize the result.",
  "children": [
    "payment-method",
    "card-charge",
    "wallet-charge",
    "payment-result"
  ],
  "entryNode": "payment-method",
  "exitNodes": ["payment-result"],
  "metrics": {
    "steps": 4,
    "branches": 2,
    "externalCalls": 2
  }
}
```

Child node:

```json
{
  "id": "card-charge",
  "parent": "payment",
  "type": "external",
  "label": "Charge card"
}
```

Both directions are intentionally explicit:

- Parent lists `children` for readable package structure.
- Child declares `parent` so the renderer can resolve visibility efficiently.

For v0.1, analyzers should keep these declarations consistent.

### Entry and exit

When a collapsed subgraph is expanded, external edges need a meaningful place to attach.

- `entryNode` is the child that receives incoming flow.
- `exitNodes` contains child nodes that leave the subgraph.

The current renderer uses the first `exitNodes` item when one external outgoing edge attaches to an expanded subgraph. Future IR versions may introduce named ports for multiple exits.

## 7. Source references

Source files are optional but strongly recommended.

```json
{
  "source": {
    "file": "source/payment.ts",
    "startLine": 44,
    "endLine": 61
  }
}
```

The browser reads the source text from the ZIP and shows the referenced lines in the details panel.

For generated or unavailable source files, a node may embed a short code fragment instead:

```json
{
  "code": "total += item.price;"
}
```

## 8. Notes vs summary

Use `summary` for the block's main meaning. It should be short enough to help scan the graph.

Use `notes` for explanations that are useful after selecting the block, for example:

- why several statements were grouped;
- an important side effect;
- a non-obvious invariant;
- a performance concern;
- an error-handling detail.

## 9. Metrics

A collapsed subgraph can expose lightweight complexity hints without expanding it:

```json
{
  "metrics": {
    "steps": 12,
    "branches": 3,
    "externalCalls": 2
  }
}
```

These values are informational. They are not coordinates and do not control layout.

## 10. No hard-coded coordinates in semantic IR

Do not emit `x`/`y` coordinates as part of source understanding. Layout belongs to the renderer.

The same semantic IR should eventually be usable for multiple views:

- architecture;
- module graph;
- function calls;
- control flow;
- data flow;
- execution trace.

## 11. Semantic compression rules for the analyzer

When converting source code to WorldEngine IR:

1. Identify the intent of the program/function/module first.
2. Extract major phases before low-level statements.
3. Merge adjacent statements serving the same purpose.
4. Keep meaningful decisions visible.
5. Collapse large branches and long functions into subgraphs.
6. Show external boundaries such as API, filesystem and database calls when they matter to understanding.
7. Keep error paths visible but do not let them dominate the primary flow.
8. Mark loop-return edges as back/loop edges.
9. Add source references so users can move from meaning back to exact code.
10. Optimize the first screen for comprehension, not completeness.

## 12. Future-compatible fields

The schema intentionally allows additional properties so later packages can introduce data such as:

```text
trace
variables
callStack
timeline
runtimeEvents
ports
views
annotations
```

The v0.1 renderer ignores unknown fields rather than rejecting the package.
