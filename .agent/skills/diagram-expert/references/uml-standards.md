# UML Standards Reference

> This document explains "model meaning" — not Mermaid syntax.
> Primary authority: https://www.omg.org/spec/UML/2.5.1/PDF

---

## Core Principle

Always evaluate diagram correctness from **UML semantics** first.
Mermaid is only a rendering format — it is not the authority on meaning.

---

## Authority Model

| Layer | Used to decide | Authority |
|---|---|---|
| **A. System Facts** | Class names, fields, endpoints, real flows | Project files provided by user |
| **B. Modeling Meaning** | Meaning of notation — composition, multiplicity | OMG UML 2.5.1 |
| **C. Rendering Syntax** | What Mermaid can render | Official Mermaid docs only |

**Conflict Resolution:**
- Real names/structure → **Project files win**
- Notation meaning → **UML semantics win**
- Uncertain syntax → **Mermaid docs win** — if not in docs, do not use it

---

## Relationship Types

### Association
Use when A relates to B but does not own its lifecycle → `-->`

Concept: shared use, reference, domain relationship — but not ownership where one dies with the other.
ref: https://www.uml-diagrams.org/association.html

### Dependency
Use when A temporarily depends on B — calls a method, imports, injects → `..>`

If it is merely "used occasionally to do something", start by considering dependency first.
ref: https://www.uml-diagrams.org/dependency.html

### Composition
Use only when the child cannot exist independently from the parent → `--*`

**Ask before using:**
- If the parent is deleted, does the child lose all meaning in every case?
- Does the child have exactly one owner?
- Was the child created specifically for this parent?

If the answer is unclear → do not use Composition, use Association instead.
ref: https://www.uml-diagrams.org/composition.html

### Aggregation
Use sparingly — if ownership is weak or uncertain, use Association instead → `--o`
ref: https://www.uml-diagrams.org/aggregation.html

### Generalization
Use only for a **true is-a relationship** → `--|>`
- Correct: `AdminUser --|> User`
- Wrong: `Service --|> Controller` (not an is-a)
- Wrong: using it for layer hierarchy
ref: https://www.uml-diagrams.org/generalization.html

---

## Multiplicity / Cardinality

**Key rule: do not infer full business semantics from FK shape alone.**

What the schema can tell you:
- FK nullable → child side is usually optional (`0..1`)
- FK not null → child side is usually mandatory (`1`)
- FK unique → referencing side is usually at most one
- FK not unique → referencing side is usually many

What the schema cannot tell you:
- Business-level minimums not encoded in DDL

**If uncertain → note "inferred / uncertain" in the table — never state it as a fact.**

ref: https://www.omg.org/spec/UML/2.5.1/PDF

---

## Include vs Extend

Use as a **heuristic**, not a fixed rule. Always explain the reasoning in the table.

### Include — typically appropriate when:
- The sub-behavior is something the base use case **depends on and needs every time**
- It is reused across multiple use cases
- Extracting it makes the model clearer
- Arrow direction: **base → included**

### Extend — typically appropriate when:
- The additional behavior occurs **optionally or conditionally**
- The base use case is complete without that behavior every time
- Arrow direction: **extending → base**

ref: https://www.uml-diagrams.org/use-case-include.html
ref: https://www.uml-diagrams.org/use-case-extend.html

---

## Sequence Semantics

A sequence diagram must reflect real system behavior — not just look neat.

| Arrow | Meaning |
|---|---|
| `->>` | Solid line with arrowhead — synchronous call, waits for response |
| `-->>` | Dotted line with arrowhead — response returning |
| `-)` | Solid line with open arrow — async fire-and-forget |
| `-x` | Solid line with cross — fail / reject |

**Never use `-->>` for an async event that has no real response.**

ref: https://mermaid.js.org/syntax/sequenceDiagram.html

---

## ER Cardinality (Crow's Foot)

| Notation | Meaning |
|---|---|
| `\|\|--\|\|` | One-to-one mandatory |
| `\|\|--o\|` | One-to-one optional |
| `\|\|--o{` | One-to-many optional |
| `\|\|--\|{` | One-to-many mandatory |

- FK nullable → `o` (minimum = 0)
- FK not nullable → `|` (minimum = 1)
- Never draw M:N directly in logical/physical design → resolve as associative entity first
- If M:N is conceptual only → state clearly that it is conceptual only

ref: https://mermaid.js.org/syntax/entityRelationshipDiagram.html

---

## Anti-Patterns (Never Do)

| Anti-Pattern | Reason |
|---|---|
| Composition without justifying lifecycle | Must be able to answer "B ceases to exist when A is deleted" |
| Aggregation used indiscriminately | If unclear, use Association instead |
| Generalization for non-is-a relationships | Never use for layer hierarchy |
| Include/Extend without explaining reasoning | Must explain in relationship table every time |
| Stating cardinality beyond the evidence | Mark as "uncertain" if evidence is incomplete |
| Using `->>` for async fire-and-forget | Use `-)` instead |
| Inventing syntax to "look like UML" | Never invent Mermaid syntax not found in docs |
| Inventing classes/fields/relationships | Project files are always the source of truth |
