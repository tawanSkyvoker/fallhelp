# Output Structure

> This format is the standard for all modes and all diagram types.

---

## Mode Selection

Before responding, determine the correct mode:

| Mode | When to use |
|---|---|
| **Project Understanding** | User wants to understand structure, layers, modules, schema, or flow |
| **Documentation / Thesis Support** | User wants to write a report, thesis chapter, or academic explanation |
| **Diagram Generation** | User explicitly requests a diagram |

**Do not draw a diagram until the user explicitly requests one** — if the user only asks about structure or wants to write a report, respond with explanation and tables first.

---

## Required Output Order

### Project Understanding

```
1. Project overview
2. Files read and context used
3. System structure / layers / modules
4. Data or control flow
5. Key points or things to watch out for
6. Suggested next steps
```

### Documentation / Thesis Support

```
1. Purpose of the content to be written
2. Files used as evidence
3. Topic outline
4. Draft content
5. Summary tables / diagrams / design decisions to attach
6. Points still needing confirmation from the user or code
```

### Diagram Generation

```
1. Understanding of the request
2. Files read and context used
3. Scope / Depth and reasoning
4. Assumptions / Limitations (if any)
5. Mermaid code (Class / Sequence / ER) or Tables (Use Case)
6. Main table
7. Relationship table
8. Design Decisions / Notes
9. How to use the output next
```

---

## Global Rules

- Never output code alone without semantic tables
- Always state which files were used as evidence
- Clearly separate "confirmed from files" from "interpreted / assumed / uncertain"
- If information is insufficient, state the limitation explicitly

---

## Mandatory Tables by Diagram Type

### Class Diagram

- `Class Name | Stereotype | Layer | Role | Key Attributes/Methods | Notes`
  ← Show every class with its real layer and role

- `Source | Target | Type | Notation | Meaning | Reason`
  ← Explain every relationship — why Association / Dependency / Composition was chosen

- `Assumption or Limitation | Source | Impact if Wrong`
  ← Record anything assumed; if there are no assumptions, state that explicitly

---

### Use Case

- `Actor (Thai) | Type | Goal | System Involvement | Notes`
  ← Identify every actor as Primary / Secondary / External System

- `Use Case (Thai) | Goal | Primary Actor | Trigger | Main Flow | Alt Flows | Exception Flows | Postconditions | Business Rules`
  ← Full specification for every use case

- `Source | Target | Type | Arrow Direction | Meaning | Reason`
  ← Explain every relationship with the reasoning for Include / Extend choice

---

### Sequence Diagram

- `Participant | Type | Role | Reason for inclusion in sequence`
  ← Explain every participant that has a real role in the flow

- `Step | From | To | Message | Arrow | Meaning | Condition`
  ← Show every step of the call chain with the correct arrow type

- `Fragment | Scope | Meaning | Condition | Reason`
  ← Explain every alt / opt / loop used

- `Symbol | Meaning | When to use | Caution`
  ← Summarize the arrow types actually used in this diagram

---

### ER Diagram

- `Entity | Table | Meaning | PK | FK | Key Attributes | Notes`
  ← Show every entity with key fields; note special constraints

- `Entity A | Entity B | Cardinality | Optionality | Notation | Meaning | Reason`
  ← Explain every relationship with cardinality derived from the real schema

- `Entity | Key Type | Attribute | Meaning | Notes`
  ← Summarize all key constraints (PK, UK, composite key, logical ref)

- `Issue | Decision | Reason | Impact | Notes`
  ← Record design decisions such as missing physical FK, composite keys

---

## Final Section Guidance

### Design Decisions / Notes
Use whenever at least one of the following applies:
- Mermaid cannot fully express the semantics
- Schema cannot fully determine cardinality (mark as "uncertain")
- A logical relation exists without a physical FK
- A composite key is involved
- A fragment or relationship requires special explanation

### How to Use the Output Next
Keep this short and actionable. Examples:
- Paste the Mermaid code into Draw.io or mermaid.live to render
- Use the tables to review with the team
- Incorporate into Chapter 3/4/5 of the report
- Split into additional diagrams if the current one is too dense

---

## Hard Rules

- Never output code without semantic tables
- Never invent classes, fields, endpoints, or events not in the real project
- Never claim Mermaid has native Use Case syntax
- Never use Composition without justifying the lifecycle dependency
- Never show every domain in full detail in a single diagram
- Never output PlantUML
- Never cite uml-diagrams.org as a substitute for OMG UML 2.5.1
- Never assume project structure without file evidence
- Never name Use Case Actors or Use Cases in English
- Never use Thai in Class, Sequence, or ER identifiers that must match code
- Never state cardinality beyond what the schema supports — mark as "uncertain" when unsure
- Never draw a diagram prematurely if the user has not requested one or context is insufficient
- Never proceed without informing the user when context from a prior diagram is missing
