# Use Case Rules

---

## Core Principle

**Analyze first, draw later.**

The primary output is **tables** that can be used to draw the diagram manually or with a tool.
Not Mermaid code — Mermaid has no native Use Case syntax.

**Language:** Actor names and Use Case names must always be in Thai.
Use Cases represent "what the user wants to achieve" — not code identifiers.

---

## Process Order (always follow this sequence)

1. Extract Actors from requirements — who uses the system, or what external systems interact with it
2. Extract Use Cases from requirements — what each Actor needs to accomplish
3. Define System Boundary — what is inside the system, what is outside
4. Define Relationships: Association / Include / Extend / Generalization
5. Write Use Case Specification for every use case
6. Produce the mandatory tables

---

## Actor Types

| Type | Meaning | Example (Thai name) |
|---|---|---|
| Primary | Initiates the use case to achieve their own goal | ผู้ใช้, ผู้ดูแลระบบ, ลูกค้า |
| Secondary | Helps the system respond to the primary actor | ระบบอีเมล, ระบบชำระเงิน |
| External System | An external system that interacts with the system | API ภายนอก, อุปกรณ์ IoT, Message Broker |

---

## Correct Use Case Naming

- Format: **Verb + Noun** — e.g. "ล็อกอิน", "ตรวจจับการล้ม", "ดูรายงาน", "จัดการอุปกรณ์"
- Must answer: "What does the Actor want to achieve?"
- Never name a Use Case after an internal process — e.g. "ตรวจสอบ Token", "บันทึกข้อมูล"

---

## Use Case Specification Template

```
Use Case:      [Verb + Noun in Thai — e.g. "สั่งซื้อสินค้า"]
Goal:          [Goal the primary actor wants to achieve]
Primary Actor: [Actor name in Thai]
Secondary:     [Other actors / systems involved]
Trigger:       [Event that starts the use case]
Preconditions: [Conditions that must be true before starting]

Main Flow:
  1. ...
  2. ...

Alternative Flows:
  A1: [Condition] → [Steps]

Exception Flows:
  E1: [Error] → [Handling]

Postconditions:  [System state after completion]
Business Rules:  [Rules that govern this flow]
```

---

## Include vs Extend Decision

| Question | Yes | No |
|---|---|---|
| Does it occur every time the base runs? | Include | Extend |
| Is the base still complete without it? | Extend | Include |
| Is it reused across multiple use cases? | Include | May be a step in the main flow |

- Include → arrow points from base → included
- Extend → arrow points from extending → base

---

## Mandatory Tables (primary output)

**1. Actor and Goal Table**
`Actor (Thai) | Type | Goal | System Involvement | Notes`

**2. Use Case Specification Table**
`Use Case (Thai) | Goal | Primary Actor | Trigger | Main Flow | Alt Flows | Exception | Postconditions | Business Rules`

**3. Relationship Table**
`Source | Target | Type | Arrow Direction | Meaning | Reason`

> Tables 1–3 are the primary output — they can be used directly to draw the diagram with a tool or by hand.
