# Haven Configurator

A sectional-sofa configurator for the Haven sofa, built to use live with clients on an iPad. You pick a shape, type the room measurements and arrange the pieces in a to-scale plan. An orthographic 3D view shows the same sofa, and the app exports client and shop PDF sheets and share links.

It is a standalone web app (Vite + React + TypeScript, installable on the iPad home screen). There is no login and no backend: each layout lives in its link and on the device.

**Status: H6, sheets and sharing.** Pick a shape, type the room, see the to-scale plan with dimensions, seat count and warnings, and switch to an orthographic 3D view (Top, Front, Side, 3/4, Iso; orbit and it springs back). Edit in the plan by touch: drag seams, drag tables (drop on the tray to remove), long-press to reorder, tap a piece for its menu, add pieces from the tray, move an ottoman or coffee table with live clearances. Tables come standard (2″ wood top on a fabric base) or all wood. 3D shows pillows like the showroom (two squares and a ball at each corner and arm end); pick the fabric and wood finish, and a Sketch style for the plan. Share makes a one-page PDF (or PNG): the plan to scale with its measurements plus the 3D views you tick, ready for the iPad share sheet. Send a view-only or editable link, and save layouts on the device. Works offline once installed.

```
npm install
npm run dev            # http://localhost:5173
npm test && npm run lint && npm run build && npm run check:bundle
npm run e2e            # after a build; set HAVEN_CHROMIUM to a Chromium binary in cloud sandboxes
```

Node ≥ 22.12 (`.nvmrc`).

- Build plan, spec, prototypes and evidence: [`docs/README.md`](docs/README.md) (the plan is [`docs/HAVEN-PLAN.md`](docs/HAVEN-PLAN.md))
- Instructions for Claude Code sessions: [`CLAUDE.md`](CLAUDE.md)
