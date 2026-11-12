# canva-app

screenRIG's app in the Canva Apps Marketplace: a Content Publisher intent
(`src/intents/content_publisher`) that sends the open design to screenRIG
screens. This repository is **public**: no internal hosts, private origins,
customer data or secrets.

- The screenRIG API contract is `backend`'s (`POST /api/canva/publishes`,
  the `screenrig-canva` OAuth client, the browser-origin allowlist). Change
  `backend` first; never invent an endpoint, field or problem here.
- `src/screenrig/design.ts` holds the pure helpers and their tests; the
  network code is `src/screenrig/api.ts` and `src/screenrig/publish.ts`.
- Gates: `npm run lint:types`, `npm run lint`, `npm run format:check`,
  `npm test`. `npm run build` makes the bundle the Developer Portal takes.
- The listing packet is `marketing/stores/canva/`.
