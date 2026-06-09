# Diagram Selection Policy

Use this reference when deciding whether to summarize, clarify, or draw.

## Mode Selection

| User wants | Do first |
|---|---|
| Understand project structure | Summarize architecture/layers/files first — do not draw yet |
| Write report / thesis | Summarize from source files as prose/tables first |
| Create a diagram | Analyze context -> ask if missing -> draw |
| Unclear goal | Ask 1 clarifying question to determine mode |

## Diagram Progression

```text
1. Use Case      -> what the system does + who uses it
2. Class Diagram -> what the system is made of
3. Sequence      -> how each use case works
4. ER Diagram    -> how data is structured
```

## Session Handling

When prior context is missing:

- follow the progression and start from Use Case
- or ask the user for the missing prior output
- or draw from available files and state assumptions explicitly
