# screenRIG for Canva

The screenRIG app for Canva publishes the open design to screenRIG screens.
It uses Canva's Content Publisher intent, so it appears in the design's
**Share** menu.

1. **Connect screenRIG** signs in with screenRIG. Canva runs the OAuth flow,
   and the person picks the project on screenRIG's consent page.
2. The person picks the pages (as images) or a video, the seconds each page
   shows, and the screens that play it.
3. **Publish** sends Canva's export files to screenRIG
   (`POST /api/canva/publishes`). screenRIG downloads them from Canva and
   creates one media item per page. Publishing the same design again replaces
   those media items in place: same media id, next version. The screens
   update without new playlist entries.
4. The design plays as its own playlist, named after the design. The app
   makes it the default playlist of each chosen screen.

Docs: <https://screenrig.ai/docs>. Contact: contact-us@screenrig.ai.

## Develop

Requirements: Node.js 24 and npm 11 (`.nvmrc`).

```bash
npm install
npm start
```

Open the app in the Canva Developer Portal and preview it in the editor
(the development server only serves the JavaScript bundle at
<http://localhost:8080>).

`CANVA_BACKEND_HOST` in `.env` is the screenRIG API origin the app calls, by
default `https://api.screenrig.ai`. The screenRIG API answers CORS only for the
Canva app origins it is configured with.

## Check

```bash
npm run lint:types
npm run lint
npm run format:check
npm test
```

## Release

`npm run build` writes `dist/app.js`. Upload it as a new version in the
Canva Developer Portal and submit that version for review.

The Developer Portal holds the OAuth settings:

| Setting | Value |
| --- | --- |
| Provider | `screenrig` |
| Authorization server URL | `https://api.screenrig.ai/oauth/authorize` |
| Token exchange URL | `https://api.screenrig.ai/oauth/token` |
| Revocation exchange URL | `https://api.screenrig.ai/oauth/revoke` |
| Client ID | `screenrig-canva` |
| Credential transfer mode | Headers |
| PKCE | On |
| Scopes | `access:manage` |

## License

The Canva starter components in this repository are licensed under the terms
in [LICENSE.md](LICENSE.md).
