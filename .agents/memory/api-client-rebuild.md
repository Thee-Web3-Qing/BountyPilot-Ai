---
name: API Client Rebuild
description: lib/api-client-react is a composite TypeScript project; source edits need tsc rebuild to propagate to consuming apps.
---

## Rule
After editing any file in `lib/api-client-react/src/`, run:
```
cd lib/api-client-react && npx tsc -p tsconfig.json
```
This regenerates the `.d.ts` files in `dist/` that consuming apps (like `artifacts/bountypilot`) read via project references.

**Why:** The `tsconfig.json` has `composite: true` and `emitDeclarationOnly: true`. TypeScript project references resolve types from the compiled `dist/` output, NOT the source files directly. Editing `src/generated/api.schemas.ts` without rebuilding leaves the old `.d.ts` in place and the consuming app sees stale types.

**How to apply:** Any time you add a field to the generated Bounty/ResearchBrief/ProductionPlan types in `api.schemas.ts`, or any other type in `api-client-react/src/`, always follow the edit with the rebuild command.
