# Haven Configurator

A sectional-sofa configurator for the Haven sofa, built to use live with clients on an iPad. You pick a shape, type the room measurements and arrange the pieces in a to-scale plan. An orthographic 3D view shows the same sofa, and the app exports client and shop PDF sheets and share links.

It is a standalone web app (Vite + React + TypeScript, installable on the iPad home screen). There is no login and no backend: each layout lives in its link and on the device.

**Status: scaffold only (H0b): a placeholder page, no configurator yet.**

```
npm install
npm run dev            # http://localhost:5173
npm test && npm run lint && npm run build && npm run check:bundle
npm run e2e            # after a build; set HAVEN_CHROMIUM to a Chromium binary in cloud sandboxes
```

Node ≥ 22.12 (`.nvmrc`).

- Build plan, spec, prototypes and evidence: [`docs/README.md`](docs/README.md) (the plan is [`docs/HAVEN-PLAN.md`](docs/HAVEN-PLAN.md))
- Instructions for Claude Code sessions: [`CLAUDE.md`](CLAUDE.md)
