# Promptville

Promptville is a local-only 3D visualization of your opencode history, rendered as a low-poly cartoon toy town. Every opencode **project** becomes a city block; every **session** becomes a house. Houses encode your work at a glance:

- **Height** scales with token usage (bigger house = more tokens)
- **Roof color** encodes the model
- **Body color** identifies the project
- A cartoon HUD shows aggregate stats: total cost, tokens, top models, top projects

The scene is built with React Three Fiber and reads the opencode sqlite database read-only through a small Bun API server. Data is live from your local database — refresh the page to re-fetch.

## Features

- Procedural low-poly town: connected street graph, grass lots, park, trees, lamps, and a mountain ring boundary
- Interactive houses: hover to highlight, click for a detail card (title, model, agent, cost, tokens, date) with a floating title banner
- Paper-style HUD: Fredoka + Nunito, pastel palette
- `frameloop="demand"` rendering (GPU-idle when the scene is static) with shared geometries

## Requirements

- Bun ≥ 1.3

## Run

```bash
bun install
bun run dev
```

Open http://localhost:5173. The API reads `~/.local/share/opencode/opencode.db` read-only. Point at another database with `OPENCODE_DB_PATH`.

## Scripts

- `bun run dev` — API server (:4100) + Vite (:5173)
- `bun run build` — typecheck + production build
- `bun run typecheck` — both workspaces
- `bun test` — server DB/API + app layout tests

## Project layout

```
server/   Bun.serve API + Drizzle ORM over bun:sqlite (read-only)
app/      Vite + React 19 + React Three Fiber frontend
docs/     design spec, implementation plan, R3F reference
```

## Documentation

- Design spec: `docs/superpowers/specs/2026-08-27-opencode-city-3d-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-27-promptville.md`
- React Three Fiber patterns used here: `docs/r3f-reference.md`

## Notes

- Reads the opencode database read-only — it never mutates your data.
- Local only by design: no deployment, no auth, no real-time updates.