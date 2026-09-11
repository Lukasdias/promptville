# Promptville

A local-only 3D visualization of your opencode history, rendered as a low-poly cartoon town. Each opencode project becomes a city block; each session becomes a house.

- Height scales with token usage.
- Roof color encodes the model; body color identifies the project.
- Layout is deterministic: projects are ranked by activity (session count, then recency) and placed on a fixed grid around a central plaza. House slots use fixed columns, so adding a session never moves existing houses.
- A HUD shows total cost, tokens, top models, and top projects.

Built with React Three Fiber. Reads the opencode SQLite database read-only through a Bun API server. Data is live from the local database; refresh to re-fetch.

## Features

- Procedural town: street graph with sidewalks and crosswalks, grass lots, trees/lamps/bushes/flowers, and a mountain ring boundary.
- Day/night cycle: sky gradient, sun/moon lighting, warm window and lamp glow at night, rain/dust/fog layers, clock and auto-cycle toggle.
- Traffic: cars and pedestrians follow the street graph with signal-controlled intersections and crosswalks.
- Crowd: NPC clusters on the plaza with speech bubbles sourced from recent user/assistant messages in your database.
- Civic district: hospital, police, fire station, mall, bakery, and pet shop, each with a visitor and vehicle activity ring.
- Session navigator: search, filter (project / model / agent / date), and sort sessions; a chat sidebar shows the selected session's transcript.
- Audio: day/night crossfading soundtrack, mute toggle, attribution panel. Playback starts after a click on the loading splash.
- Tweak panel: toggle scene layers (buildings, traffic, people, scenery, clouds, rain, dust, fog, signals, mountains) and choose which stats rows show.
- Interactive houses: hover to highlight, click for a detail card (title, model, agent, cost, tokens, date) with a floating title banner.
- Paper-style HUD: Fredoka + Nunito, pastel palette.
- `frameloop="always"` (continuous animation) with shared geometries and instanced voxels.

## Requirements

- Bun ≥ 1.3

## Run

```bash
bun install
bun run dev
```

Open http://localhost:5173. The API reads `~/.local/share/opencode/opencode.db` (falls back to `~/.opencode/opencode.db`) read-only. Point at another database with `OPENCODE_DB_PATH`.

## Scripts

- `bun run dev` — API server (:4100) + Vite (:5173)
- `bun run build` — typecheck + production build (app)
- `bun run typecheck` — both workspaces (server + app)
- `bun test` — server DB/API/parts tests + app logic tests

## Project layout

```
server/       Bun.serve API + Drizzle ORM over bun:sqlite (read-only)
app/          Vite + React 19 + React Three Fiber frontend
docs/         design specs, implementation plans, R3F reference
screenshots/  example captures of the running town
```

## Screenshots

| Capture | Shows |
|---------|-------|
| ![daytime aerial view](screenshots/daytime-aerial-view.png) | Daytime town: city blocks, plaza, civic buildings, stats panel |
| ![night navigator](screenshots/night-navigator.png) | Session navigator open over the night scene |
| ![feature bubble](screenshots/night-navigator-bubble.png) | Crowd bubble called out near the plaza |
| ![tweak panel](screenshots/tweak-panel.png) | Tweak display panel and time-of-day slider |
| ![session chat detail](screenshots/session-chat-detail.png) | Chat sidebar and session detail card for a house |

## API

- `GET /api/neighborhood` — stats, projects, and crowd chatter lines
- `GET /api/session/:id` — a session's detail (with a snippet of its latest text)
- `GET /api/session/:id/messages` — the session's message transcript

## Documentation

- Design specs: `docs/superpowers/specs/` (city layout, public buildings, streets, crowd, layered city, day/night, session chat/navigator, camera, ground textures)
- Implementation plans: `docs/superpowers/plans/`
- React Three Fiber patterns used here: `docs/r3f-reference.md`

## Notes

- Reads the opencode database read-only; never mutates your data.
- Local only: no deployment, no auth, no real-time updates.
