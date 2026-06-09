# Commenting Reference

Use this reference when a task needs comment quality work or when edited files gain meaningful state, business flow, or multi-step logic.

## Core Rules

- Write comments in Thai by default
- Keep important technical terms in English when clearer
- Explain intent, business rules, and side effects, not trivial syntax
- Prefer file-level JSDoc-style headers for files with meaningful orchestration, state, side effects, or cross-file flow
- Use short inline comments for guards, timing windows, cache/socket/MQTT side effects, and business rules that are easy to misread
- Use `ไฟล์ถัดไป: path/to/file.ts` breadcrumbs only when the current code intentionally hands work to another file
- Avoid decorative separator banners and import group labels
- Remove stale comments when behavior changes

## Focus Areas

- File or module purpose
- Multi-step logic
- Business rules and terminology
- Side effects, constraints, and integration impact
- Technical limitations and workarounds

## Avoid

- Line-by-line narration
- Trivial comments
- English-only section headers
- Import block labels such as `// Framework & Libraries`, `// Services`, or `// Types`
- Long separator banners used only for visual grouping
- Vague placeholders like `todo`, `fix bug`, `handle error`
- Outdated comments that describe removed behavior

## File Header Pattern

Use this pattern for Mobile, Backend API, and Admin files when the file owns meaningful workflow:

```ts
/**
 * file-name.ts
 *
 * หน้าที่หลักของไฟล์นี้
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - งานหลักข้อที่ 1
 * - งานหลักข้อที่ 2
 * - side effect หรือ integration สำคัญ
 */
```

Do not add a header just to satisfy a checklist. Small type files, tiny components, and obvious re-export files can stay comment-light.

## Inline Comment Pattern

Use concise Thai-first comments beside logic that carries intent:

```ts
// หน่วง offline จาก MQTT เพื่อกัน dashboard กระพริบระหว่าง reconnect สั้น ๆ
// ไฟล์ถัดไป: iot/handlers/statusHandler.ts
```

## FallHelp-Specific Expectations

- Explain `Cancel` vs `Acknowledge` (`รับทราบแล้ว`) where relevant
- Explain the 2-stage fall flow when relevant
- Explain MQTT -> Backend -> Socket.io -> Push flow when relevant
- Explain BLE provisioning and WiFi setup flow when relevant
- Explain schema constraints and server timestamp rules when relevant

## Verification

```bash
npm run audit:comments:strict
```
