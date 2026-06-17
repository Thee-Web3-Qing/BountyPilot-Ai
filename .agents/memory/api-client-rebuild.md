---
name: Composite TS Package Rebuild
description: Both lib/db and lib/api-client-react are composite TS projects; source edits need tsc rebuild to propagate to consuming apps.
---

## Rule
After editing schema in `lib/db/src/` or types in `lib/api-client-react/src/`, always rebuild:
```
cd lib/db && npx tsc -p tsconfig.json
cd lib/api-client-react && npx tsc -p tsconfig.json
```

**Why:** Both packages have `composite: true` + `emitDeclarationOnly: true`. TypeScript project references resolve types from compiled `dist/` output, NOT source directly. Editing source without rebuilding leaves stale `.d.ts` files — consuming apps (api-server, bountypilot) silently see the old type shape, causing "property does not exist" errors.

**How to apply:** Any schema column addition to `lib/db/src/schema/` requires a db rebuild before the api-server will see it. Any type change in `api-client-react/src/generated/api.schemas.ts` requires an api-client-react rebuild before the bountypilot frontend will see it. Always do both after a schema change that touches both layers.
