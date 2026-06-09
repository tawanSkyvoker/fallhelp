# Mermaid Syntax Reference

> This document covers "what Mermaid can safely render" — not UML meaning.
> ref: https://mermaid.js.org/intro/

---

## Core Rule

Use **documented Mermaid syntax only**.

Never:
- Invent keywords or diagram types not in the docs
- Invent pseudo-arrows or pseudo-key types
- Use syntax guessed from UML appearance
- If uncertain → simplify the code and explain in a table instead

---

## Supported Diagram Types

| Diagram | Declaration |
|---|---|
| Class Diagram | `classDiagram` |
| Sequence Diagram | `sequenceDiagram` |
| ER Diagram | `erDiagram` |

**Use Case has no documented native Mermaid syntax → output as tables only.**
**Never output PlantUML under any circumstances.**

---

## General Safety Rules

### 1. Syntax Purity
Use only syntax documented in Mermaid docs.

### 2. One Relation per Line
- Write **1 relation per line** at all times
- Never chain edges even though Mermaid allows it
- Reason: prevents AI from placing labels or relations incorrectly

### 3. Text Safety
For display text containing special characters, spaces, or non-ASCII:
- Use the quoted/escaped label form supported by Mermaid
- Choose the safest form for that diagram type

### 4. `end` Safety
- **Never use bare lowercase `end` as general text**
- `end` is Mermaid control syntax (closes a fragment)
- If the word "end" must appear as text, escape or quote it correctly

### 5. Keep Mermaid Short
- Reasoning and explanation belong in semantic tables
- Code should contain only the structural information

---

## Class Diagram

```
classDiagram
    direction TB

    class ClassName {
        <<Stereotype>>
        +publicAttr Type
        -privateAttr Type
        +publicMethod() ReturnType
    }

    ClassA ..> ClassB : dependency
    ClassA --> ClassB : association
    ClassA "1" --> "*" ClassB : with multiplicity
    ClassA --|> ClassB : generalization
    ClassA --* ClassB : composition
    ClassA --o ClassB : aggregation
```

**Notes:**
- Reverse arrow forms (`*--`, `o--`, `<|--`) also render — use one form consistently throughout the project
- Stereotypes/annotations are project conventions, not universal UML standards
- Layout is automatic and cannot be forced

---

## Sequence Diagram

```
sequenceDiagram
    actor User
    participant Controller
    participant Service
    participant DB

    User->>Controller: HTTP POST /resource
    Controller->>Service: handleRequest(data)
    Service->>DB: query()
    DB-->>Service: result
    Service-->>Controller: response
    Controller-->>User: 200 OK

    alt Validation fails
        Controller-->>User: 400 Bad Request
    end

    opt Optional step
        Service->>Logger: log()
    end

    loop Retry
        Service->>DB: retry()
    end
```

**Supported Fragments:** `alt`, `opt`, `loop`, `par`, `critical`, `break`, `rect`, `note`

**Safety:**
- Never use response arrow (`-->>`) for an async event that has no real response
- Never use bare `end` as text
- Never include participants that have no real role in the flow

---

## ER Diagram

```
erDiagram
    User ||--o{ Session : "has"
    User ||--o| UserProfile : "owns"

    User {
        string id PK
        string email UK
        string name
    }

    Session {
        string id PK
        string userId FK
        datetime createdAt
    }

    UserProfile {
        string id PK
        string userId FK, UK
        string displayName
    }
```

**Cardinality Symbols:**
- `||` exactly one
- `o|` zero or one
- `}|` one or more
- `o{` zero or more

**ER Key Purity:**
- Use only key markers supported by Mermaid docs: `PK`, `FK`, `UK`
- Never add markdown formatting inside key markers
- **Never invent `CPK` as native syntax** — for composite keys, mark each attribute and explain in Design Decisions

**Composite Key:**
- Mark each attribute that forms the composite key using the supported form
- Explain in Design Decisions which attributes together form the composite key

**Logical Reference:**
- If a relation is logical but has no physical FK → show based on actual schema, then explain in notes/tables that it is a logical reference

**Limitations:**
- Native composite PK is not supported
- Layout is automatic and cannot be forced

---

## Hard Restrictions

- Never output PlantUML
- Never invent Use Case Mermaid syntax
- Never invent ER key syntax
- Never use uncertain Mermaid syntax hoping the parser will accept it
- Never chain edges in generated output
- Never use bare `end` as text
