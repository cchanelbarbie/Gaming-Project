# Frontline

Two commanders, three units each, one tactical battlefield. The existing mobile-friendly design is preserved. Share a room invite to play on separate devices.

## Clear objectives

Move one square horizontally or vertically, or attack an adjacent enemy, once per turn. Units have 2 health; attacks deal 1 damage. Attackers stay in place after defeating a unit. Win a round by occupying the enemy headquarters (★) or eliminating all enemy units. Blue starts round 1; starters alternate. Both players accept the next round. A match always has three rounds; each round victory earns one point and the highest score wins the match.

## Netlify deployment

The project uses one standard Netlify Function, `netlify/functions/game.ts`, reached directly at `/.netlify/functions/game`. Helpers live under `lib/`, outside the functions directory. Netlify Blobs stores shared rooms using strong consistency, create-only writes, and ETag conditional updates. No application API keys, environment-variable configuration, external server, or manual database setup are required when deployed through a Netlify function-capable deployment.

**Netlify's static drag-and-drop uploader does not build or deploy Functions.** Uploading this source ZIP there will not enable multiplayer. The complete project archive is prepared for Netlify's build/function deployment pipeline; a function-capable deployment mechanism or publisher is required. Netlify configuration: build command `npm run build`, publish directory `dist`, functions directory `netlify/functions`. There is no custom function path or API redirect.

ChatGPT Sites publishing was not available in the tools exposed to this chat. No Netlify or Sites publication is claimed.

## Package contents and validation

The archive includes root-level configuration, manifests and lockfile, frontend source, built static assets, the TypeScript function, its self-contained compiled ESM bundle, helpers, build scripts and tests. Dependencies, caches, logs and Git metadata are excluded. The compiled function is under `.netlify/functions/game/game.mjs`; this is a build artifact, not proof of a hosted deployment.

The production bundle is exercised through the real Netlify Blobs SDK using a simulated HTTP storage service with conditional writes. Tests cover a complete three-round match (Blue 2, Red 1), combat, unauthorized actions, simultaneous writes, reconnect state, duplicate requests and write conflicts. These tests do not validate live Netlify storage or a published site.

## Operational behavior

State is polled every 1.5 seconds while the game page is open. Rooms survive function invocations and expire after seven days. Room codes reserve two seats; tokens authorize moves and are retained in the same browser tab. Both players see authoritative scores and final outcomes. Once all three rounds finish, create a new room for another match. The UI indicates seats have joined; it does not claim to detect online presence.

## Development reference

For developers: Node.js 22+, `npm ci`, `npm test`, and `npm run build`. Tests generate and execute the production bundle. Use Netlify's development tooling for local function/Blobs integration. These commands are reference instructions, not a required end-user setup flow.
