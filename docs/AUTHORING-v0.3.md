# WorldEngine v0.3 Authoring Specification

This document is the normative guide for converting source code into a WorldEngine input package.

The goal is not to mirror syntax. The goal is to produce a compact, evidence-backed semantic model that explains the program accurately across several coordinated views.

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

---

## 1. Core contract

A WorldEngine package represents one analyzed program/repository as five coordinated layers:

```text
Program
├── Control Flow          what can execute next?
├── Call Graph            who calls whom?
├── Data Flow            where do important values come from/go to?
├── Async / Concurrency  what waits, resumes, spawns, joins or communicates?
└── Scenarios            what happens in a concrete execution path?
```

No single view is expected to contain every fact.

The analyzer MUST prefer semantic accuracy and readability over statement-by-statement completeness.

---

## 2. Recommended ZIP layout

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
    └── ... original or selected source files
```

A package MAY omit a view that is not meaningful for the program.

Examples:

- a simple synchronous algorithm may only contain Control Flow + Scenarios;
- a library may contain Call Graph and Data Flow but no useful runtime scenario;
- a concurrent service SHOULD include Async / Concurrency.

---

## 3. manifest.json

Recommended manifest:

```json
{
  "format": "worldengine-package",
  "version": "0.3",
  "defaultView": "controlFlow",
  "defaultScenario": "happy-path",
  "views": {
    "controlFlow": {
      "path": "views/control-flow.json",
      "type": "control-flow",
      "title": "Control Flow"
    },
    "callGraph": {
      "path": "views/call-graph.json",
      "type": "call-graph",
      "title": "Call Graph"
    },
    "dataFlow": {
      "path": "views/data-flow.json",
      "type": "data-flow",
      "title": "Data Flow"
    },
    "async": {
      "path": "views/async.json",
      "type": "async-concurrency",
      "title": "Async / Concurrency"
    }
  },
  "scenarios": "scenarios.json",
  "sourceRoot": "source/"
}
```

Rules:

1. `format` MUST be `worldengine-package`.
2. `version` MUST describe the emitted contract version.
3. `defaultView` SHOULD reference an existing key in `views`.
4. `defaultScenario` SHOULD reference an existing scenario ID.
5. Paths MUST be ZIP-relative paths using `/` separators.
6. A v0.3 package SHOULD use `views`; `graph` remains supported only for backward compatibility.

---

## 4. Stable identity

Stable identity is essential because nodes from different views must refer to the same semantic concept.

### 4.1 Visual node ID

Every node MUST have a unique `id` within its view.

Recommended style:

```text
cf.checkout.validate
cf.checkout.payment
call.checkout
call.processPayment
data.order.total
async.payment.card-request
```

IDs SHOULD be deterministic. Re-analyzing unchanged source SHOULD produce the same IDs.

Do not use random UUIDs unless source identity is impossible to derive.

### 4.2 Cross-view semantic identity

Related nodes in different views SHOULD share:

```json
{
  "metadata": {
    "semanticId": "checkout.payment"
  }
}
```

Example:

```text
Control Flow node:   cf.checkout.payment
Call Graph node:     call.processPayment
Data Flow node:      data.payment.transform

metadata.semanticId = "checkout.payment"
```

`semanticId` describes the real program concept, while `id` describes a node in a particular graph.

### 4.3 Symbol identity

Functions/classes/modules SHOULD additionally expose stable symbol information when known:

```json
{
  "metadata": {
    "semanticId": "checkout.payment",
    "symbol": "src/checkout.ts::processPayment",
    "qualifiedName": "CheckoutService.processPayment"
  }
}
```

---

## 5. Evidence and certainty

The analyzer MUST NOT present guesses as source facts.

Important semantic nodes SHOULD contain evidence.

Primary source reference:

```json
{
  "source": {
    "file": "source/checkout.ts",
    "startLine": 42,
    "endLine": 61
  }
}
```

When a semantic block combines multiple source regions, use the main range in `source` and additional evidence in metadata:

```json
{
  "metadata": {
    "certainty": "observed",
    "evidence": [
      { "file": "source/checkout.ts", "startLine": 42, "endLine": 61 },
      { "file": "source/payment.ts", "startLine": 10, "endLine": 27 }
    ]
  }
}
```

Recommended certainty values:

```text
observed   directly supported by source structure
inferred   semantic interpretation derived from source
runtime    only guaranteed for a supplied runtime scenario
possible   dynamic target/path is possible but not statically guaranteed
unknown    analyzer cannot resolve accurately
```

If certainty is `possible` or `unknown`, the node/edge SHOULD include a note explaining why.

Do not invent a concrete dynamic call target when the source does not establish it.

---

## 6. Common view object

Each view file is a graph object:

```json
{
  "version": "0.3",
  "id": "controlFlow",
  "type": "control-flow",
  "title": "Checkout control flow",
  "description": "Major semantic execution paths for checkout().",
  "program": {
    "id": "checkout-service",
    "title": "Checkout Service",
    "language": "TypeScript",
    "entryPoint": "checkout()"
  },
  "entryNode": "cf.checkout.start",
  "nodes": [],
  "edges": []
}
```

### Required

```text
nodes[]
edges[]
```

### Strongly recommended

```text
version
id
type
title
description
program
entryNode   (for executable/control-flow views)
```

---

## 7. Common node schema

Minimum node:

```json
{
  "id": "cf.checkout.validate",
  "type": "process",
  "label": "Validate order"
}
```

Recommended node:

```json
{
  "id": "cf.checkout.validate",
  "type": "process",
  "label": "Validate order",
  "summary": "Checks order constraints and calculates the payable total.",
  "source": {
    "file": "source/checkout.ts",
    "startLine": 20,
    "endLine": 37
  },
  "notes": [
    "Four low-level checks are intentionally grouped into one semantic step."
  ],
  "metadata": {
    "semanticId": "checkout.validation",
    "certainty": "observed",
    "symbol": "src/checkout.ts::validateOrder"
  }
}
```

### Common node fields

| Field | Requirement | Meaning |
| --- | --- | --- |
| `id` | MUST | Unique ID inside this view |
| `type` | MUST | Visual/semantic node type |
| `label` | MUST | Short readable label |
| `summary` | SHOULD | What the block means |
| `source` | SHOULD | Primary source evidence |
| `notes` | MAY | Important explanation/caveat |
| `parent` | conditional | Parent subgraph/group |
| `children` | conditional | Child node IDs |
| `entryNode` | conditional | First child entered when parent expands |
| `exitNodes` | conditional | Child exits |
| `metrics` | MAY | Compact complexity summary |
| `metadata.semanticId` | SHOULD | Cross-view identity |
| `metadata.certainty` | SHOULD | Evidence strength |

Labels SHOULD normally be 2–8 words. Put details in `summary`, not in the label.

---

## 8. Semantic compression

WorldEngine MUST NOT be generated as a raw AST visualization.

Bad:

```text
[user = request.user]
      ↓
[id = user.id]
      ↓
[active = user.active]
      ↓
[total = calculateTotal(items)]
```

Preferred:

```text
[Prepare checkout context]
      ↓
[Calculate payable total]
```

Compression rules:

1. Merge adjacent statements that serve one understandable purpose.
2. Keep decisions visible when they materially change behavior.
3. Keep important side effects visible: database writes, network calls, filesystem, queues, locks.
4. Keep error/return paths visible but do not let minor guards dominate the first screen.
5. Long branches/functions SHOULD become subgraphs.
6. First view SHOULD normally contain about 5–20 meaningful blocks.
7. Do not compress across a semantic boundary merely to reduce node count.

---

## 9. Hierarchy / subgraphs

Collapsed parent:

```json
{
  "id": "cf.checkout.payment",
  "type": "subgraph",
  "label": "Process payment",
  "summary": "Select provider, charge, then normalize the response.",
  "children": [
    "cf.payment.method",
    "cf.payment.card",
    "cf.payment.wallet",
    "cf.payment.normalize"
  ],
  "entryNode": "cf.payment.method",
  "exitNodes": ["cf.payment.normalize"],
  "metrics": {
    "steps": 4,
    "branches": 2,
    "externalCalls": 2
  },
  "metadata": {
    "semanticId": "checkout.payment"
  }
}
```

Child:

```json
{
  "id": "cf.payment.card",
  "parent": "cf.checkout.payment",
  "type": "external",
  "label": "Charge card"
}
```

Rules:

- Parent `children` and child `parent` MUST agree.
- A child MUST have at most one parent.
- Hierarchy MUST NOT contain cycles.
- `entryNode` MUST be a descendant of the parent.
- Every `exitNodes[]` entry MUST be a descendant of the parent.
- Large subgraphs SHOULD summarize complexity with `metrics`.

---

## 10. Common edge schema

Minimum:

```json
{
  "id": "cf.e.validate-to-decision",
  "from": "cf.checkout.validate",
  "to": "cf.checkout.valid"
}
```

Recommended:

```json
{
  "id": "cf.e.valid-yes",
  "from": "cf.checkout.valid",
  "to": "cf.checkout.payment",
  "label": "Yes",
  "type": "control",
  "relation": "true",
  "metadata": {
    "certainty": "observed"
  }
}
```

Rules:

1. `from` and `to` MUST reference existing nodes in the same view.
2. Edge IDs SHOULD be unique and stable, especially if execution traces reference them.
3. `type` describes the kind of relationship.
4. `relation` describes a semantic subtype/branch meaning.
5. Boolean decision edges SHOULD use `relation: "true"` and `relation: "false"`, regardless of display language.

---

## 11. Control Flow profile

Purpose: answer **what can execute next?**

Recommended node types:

```text
start
process
decision
subgraph
call
external
return
error
end
```

Recommended edge types/relations:

```text
control
back
loop
exception
return
true
false
case
default
```

Boolean branch example:

```json
[
  {
    "id": "cf.e.valid.true",
    "from": "cf.checkout.valid",
    "to": "cf.checkout.payment",
    "label": "Yes",
    "relation": "true"
  },
  {
    "id": "cf.e.valid.false",
    "from": "cf.checkout.valid",
    "to": "cf.checkout.reject",
    "label": "No",
    "relation": "false"
  }
]
```

Loop edge:

```json
{
  "id": "cf.e.next-item",
  "from": "cf.items.increment",
  "to": "cf.items.condition",
  "type": "back",
  "relation": "loop",
  "label": "Next item"
}
```

Do not use Control Flow edges for data dependencies.

---

## 12. Call Graph profile

Purpose: answer **who calls whom?**

Recommended node types:

```text
function
call
external
group
```

Recommended edge types:

```text
call
dynamic-call
callback
construct
```

Example:

```json
{
  "id": "call.e.checkout-payment",
  "from": "call.checkout",
  "to": "call.processPayment",
  "type": "call",
  "metadata": {
    "certainty": "observed",
    "callSite": {
      "file": "source/checkout.ts",
      "startLine": 48,
      "endLine": 48
    }
  }
}
```

For dynamic dispatch:

```json
{
  "type": "dynamic-call",
  "metadata": {
    "certainty": "possible",
    "candidateTargets": [
      "CardProvider.charge",
      "WalletProvider.charge"
    ]
  }
}
```

The analyzer MUST NOT arbitrarily select one dynamic target when several are possible.

---

## 13. Data Flow profile

Purpose: answer **where do important values originate, transform and get consumed?**

Recommended node types:

```text
data
value
process
external
```

Recommended edge types:

```text
data-flow
read
write
derive
transform
parameter
return-value
```

Example:

```json
{
  "id": "data.e.total-charge",
  "from": "data.checkout.total",
  "to": "data.payment.charge",
  "type": "data-flow",
  "relation": "parameter",
  "label": "amount"
}
```

Data Flow SHOULD focus on values that help explain behavior:

- user input;
- request payloads;
- important derived values;
- state mutations;
- persistence boundaries;
- values that control decisions;
- outputs.

Do not emit every temporary variable unless it is important to understanding.

---

## 14. Async / Concurrency profile

Purpose: answer **what starts independently, waits, resumes, joins, communicates or shares synchronization?**

Recommended node types:

```text
async
await
task
thread
worker
external
process
```

Recommended edge types:

```text
spawn
await
resume
join
message
concurrent
schedule
cancel
```

Example:

```json
{
  "id": "async.e.charge-await",
  "from": "async.card.request",
  "to": "async.checkout.resume",
  "type": "resume",
  "label": "response"
}
```

Concurrency metadata SHOULD identify execution context when known:

```json
{
  "metadata": {
    "semanticId": "payment.card.request",
    "executionContext": "event-loop",
    "lane": "checkout-task",
    "certainty": "observed"
  }
}
```

For shared synchronization:

```json
{
  "metadata": {
    "synchronization": {
      "kind": "mutex",
      "resource": "order-cache"
    }
  }
}
```

Current WorldEngine renders concurrency as a graph. Lane/timeline semantics are forward-compatible metadata and SHOULD only be emitted when supported by evidence.

---

## 15. Scenarios

Static views describe possible structure. A scenario describes one concrete execution path.

`scenarios.json`:

```json
{
  "scenarios": [
    {
      "id": "happy-card",
      "title": "Successful card checkout",
      "description": "Valid order paid successfully by card.",
      "view": "controlFlow",
      "inputs": {
        "paymentMethod": "card"
      },
      "trace": []
    }
  ]
}
```

Scenario IDs MUST be unique.

A useful program SHOULD include representative scenarios, not every possible path.

Recommended scenario set:

```text
happy path
important alternative branch
validation/business failure
external dependency failure
important retry/timeout path
concurrency-specific path when applicable
```

---

## 16. Trace step schema

Recommended trace step:

```json
{
  "node": "cf.checkout.valid",
  "edge": "cf.e.validate-to-valid",
  "event": "branch",
  "label": "Check validation result",
  "message": "valid = true, therefore execution follows the success branch.",
  "variables": {
    "valid": true,
    "total": 125
  },
  "callStack": [
    {
      "name": "checkout",
      "file": "source/checkout.ts",
      "line": 32
    }
  ],
  "metadata": {
    "source": "simulated",
    "certainty": "inferred"
  }
}
```

Recommended event values:

```text
enter
process
branch
call
return
error
await
resume
spawn
join
message
write
read
```

Trace rules:

1. `node` MUST exist in the scenario's selected view.
2. `edge`, when present, SHOULD be the edge used to arrive at `node`.
3. Trace order MUST follow execution order.
4. `variables` are patches by default.
5. Use `variablesSnapshot: true` to reset variable state.
6. Use `variablesRemoved` when a variable leaves the modeled state.
7. `callStack` is a full snapshot when supplied.
8. Do not fabricate runtime values. If a scenario is illustrative rather than observed, mark it clearly in scenario/step metadata.

---

## 17. Runtime provenance

Execution scenarios SHOULD state where they came from:

```json
{
  "metadata": {
    "provenance": "static-simulation"
  }
}
```

Recommended values:

```text
observed-runtime    imported from a real execution/instrumentation
unit-test           derived from a known test
static-simulation   analyzer constructed a logically valid example
user-provided       inputs/trace came from the user
partial             trace is incomplete
```

When the trace is not observed runtime data, do not describe values as measured facts.

---

## 18. Cross-view consistency

The same semantic concept SHOULD use the same `metadata.semanticId` in every view.

Example:

```text
Control Flow
  id = cf.checkout.payment
  semanticId = checkout.payment

Call Graph
  id = call.processPayment
  semanticId = checkout.payment

Data Flow
  id = data.payment.process
  semanticId = checkout.payment

Async
  id = async.payment.task
  semanticId = checkout.payment
```

This is the foundation for synchronized focus across views.

A semantic ID SHOULD remain stable across re-analysis if the underlying concept still exists.

---

## 19. Analyzer pipeline

A source-to-WorldEngine converter SHOULD use this order.

### Phase 1 — Inventory

Identify:

- languages;
- source roots;
- modules/packages;
- entry points;
- exported/public APIs;
- tests/examples that reveal runtime behavior.

### Phase 2 — Symbol model

Build a symbol table for important:

- functions/methods;
- classes/types;
- modules;
- services/external dependencies;
- important state/data structures.

Do this before drawing graphs.

### Phase 3 — Control structure

For each important entry flow:

1. determine sequence;
2. decisions;
3. loops;
4. returns/errors;
5. significant calls/side effects;
6. collapse large regions into semantic subgraphs.

### Phase 4 — Call relationships

Resolve static calls first.

For unresolved dynamic calls, represent candidates/uncertainty rather than inventing one target.

### Phase 5 — Data dependencies

Track only important values and mutations.

Prioritize data that:

- enters/leaves the system;
- controls a branch;
- crosses a function/service boundary;
- changes persistent/shared state;
- explains output.

### Phase 6 — Async/concurrency

Detect:

- async functions;
- await/suspension points;
- callbacks/events;
- task/thread/worker creation;
- queues/channels/messages;
- locks/semaphores/joins when explicit.

### Phase 7 — Semantic IDs

Assign cross-view `semanticId` values after the semantic model is stable.

### Phase 8 — Scenarios

Create representative scenarios from:

1. real tests/traces when available;
2. explicit examples;
3. otherwise conservative static simulation.

### Phase 9 — Evidence pass

Every important node/edge SHOULD be checked against source evidence.

### Phase 10 — Validation

Run the validation checklist below before packaging.

---

## 20. Validation checklist

### Structural

- [ ] Every view has `nodes[]` and `edges[]`.
- [ ] Node IDs are unique per view.
- [ ] Edge IDs are unique per view when present.
- [ ] Every edge endpoint exists.
- [ ] Default view exists.
- [ ] Default scenario exists when declared.

### Hierarchy

- [ ] Parent/child declarations agree.
- [ ] No hierarchy cycles exist.
- [ ] Entry/exit children belong to the subgraph.
- [ ] Collapsed blocks summarize their hidden logic accurately.

### Semantic

- [ ] Control Flow edges mean execution ordering.
- [ ] Call Graph edges mean calls, not execution adjacency.
- [ ] Data Flow edges mean dependency/transfer, not control ordering.
- [ ] Async edges describe async/concurrent causality.
- [ ] True/false relations are explicit on boolean branches.

### Evidence

- [ ] Important blocks have source references where possible.
- [ ] Dynamic/uncertain facts are marked as such.
- [ ] No invented runtime values are presented as observed.
- [ ] External calls are supported by code/config/evidence.

### Cross-view

- [ ] Same concept uses the same `semanticId`.
- [ ] Semantic IDs are stable and deterministic.
- [ ] Function names/symbols are qualified enough to avoid ambiguity.

### Scenarios

- [ ] Trace node IDs exist in the declared view.
- [ ] Trace order is logically possible.
- [ ] Edge IDs, when given, match the transition.
- [ ] Variables are internally consistent across steps.
- [ ] Call stack order is caller → current frame.
- [ ] Scenario provenance is stated when not observed runtime.

### Readability

- [ ] First Control Flow screen is roughly 5–20 blocks when feasible.
- [ ] Labels are short.
- [ ] Summaries explain intent.
- [ ] Minor syntax noise is compressed.
- [ ] Error paths are visible but not visually dominant.

---

## 21. Anti-hallucination rules

A WorldEngine analyzer MUST follow these rules:

1. Never create a call edge solely because two function names look related.
2. Never invent a database/API dependency that is not supported by source/config.
3. Never convert a possible dynamic target into a definite target without evidence.
4. Never invent runtime variable values unless the scenario is explicitly marked illustrative/static-simulation.
5. Never claim two nodes are the same semantic concept unless their roles truly correspond.
6. If source is incomplete, represent the gap with `certainty: "unknown"` or omit the unsupported structure.
7. Prefer a smaller accurate graph over a larger speculative graph.

---

## 22. Quality target for generated input

A high-quality WorldEngine package should let a reader answer, without opening the source first:

```text
What does this program/module do?
What are the main execution phases?
Where are the important branches and loops?
Which functions/services call each other?
Which values control behavior and outputs?
Where does asynchronous work suspend/resume?
What happens on the main success and failure paths?
Which statements/source ranges support each explanation?
```

If the package cannot answer these questions, the analyzer should improve the semantic model before adding more visual detail.

---

## 23. Preferred output contract for AI-generated packages

When an AI analyzer produces WorldEngine input, it SHOULD output in this order:

```text
1. manifest.json
2. views/control-flow.json
3. views/call-graph.json          when meaningful
4. views/data-flow.json          when meaningful
5. views/async.json              when meaningful
6. scenarios.json                when meaningful
7. source/...                    source needed by references
```

The analyzer SHOULD perform one final referential-integrity pass after all files are generated.

The renderer is intentionally tolerant of unknown extra fields, but producers SHOULD follow this specification closely so that packages remain deterministic, explainable, and compatible with future WorldEngine versions.
