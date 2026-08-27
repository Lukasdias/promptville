# Promptville

A local-only 3D toy town visualizing your opencode history. Each project is a city
block, each session is a house: height scales with token usage, roof color encodes
the model, and a cartoon HUD shows aggregate stats.

## Run

```bash
bun install
bun run dev
```

Open http://localhost:5173. The API reads the opencode sqlite database
(`~/.local/share/opencode/opencode.db`) read-only. Point at another database with
`OPENCODE_DB_PATH`.

## Scripts

- `bun run dev` — API server (:4100) + Vite (:5173)
- `bun run build` — typecheck + production build
- `bun test` — API + layout tests
- `bun run typecheck` — both workspaces

## Notes

- 3D: React Three Fiber + drei + three. Patterns: `docs/r3f-reference.md`.
- Async data: TanStack Query v5 (`app/src/query.ts`).
- Spec: `docs/superpowers/specs/2026-08-27-opencode-city-3d-design.md`.