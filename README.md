# Haven Configurator

A sectional-sofa configurator for the Haven sofa, built to use live with clients on an iPad. You pick a shape, type the room measurements and arrange the pieces in a to-scale plan. An orthographic 3D view shows the same sofa, and the app exports client and shop PDF sheets and share links.

It is a standalone web app (Vite + React + TypeScript, installable on the iPad home screen). There is no login and no backend: each layout lives in its link and on the device.

**Status: H3, the 3D view.** Pick a shape, type the room, see the to-scale plan with dimensions, seat count and warnings, and switch to an orthographic 3D view (Top, Front, Side, 3/4, Iso; orbit and it springs back). Undo, reset, share by link, works offline once installed. Editing pieces by touch (H4), the look (H5) and PDF sheets (H6) come next.

```
npm install
npm run dev            # http://localhost:5173
npm test && npm run lint && npm run build && npm run check:bundle
npm run e2e            # after a build; set HAVEN_CHROMIUM to a Chromium binary in cloud sandboxes
```

Node ≥ 22.12 (`.nvmrc`).

- Build plan, spec, prototypes and evidence: [`docs/README.md`](docs/README.md) (the plan is [`docs/HAVEN-PLAN.md`](docs/HAVEN-PLAN.md))
- Instructions for Claude Code sessions: [`CLAUDE.md`](CLAUDE.md)
