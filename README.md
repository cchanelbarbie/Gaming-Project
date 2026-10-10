# Frontline

A live, two-player tactical war game for desktop and mobile browsers. Create a room, share its URL, and have your opponent join on another device. No accounts required.

## Rules

- Each commander starts with three units, each with 2 health, on a 5×5 board.
- Blue starts. Select your unit, then an orthogonally adjacent square.
- Moving to an empty square or attacking an enemy uses your entire turn.
- Attacks deal 1 damage. A defeated unit disappears; the attacker stays in place.
- Occupy the enemy headquarters (top-center for Red, bottom-center for Blue), or eliminate all enemy units to win.
- Both commanders must accept a rematch. The first player alternates.

## Develop

Use Node.js 22 or newer (tested with 24.19.0). There are no external runtime dependencies.

```sh
npm ci
npm test
npm start
```

The server listens on all interfaces, using `PORT` (default 3000). `/health` is the health endpoint. Game state and player connectivity are synchronized through server-sent events. Moves are validated on the server. Refreshing the same browser tab restores its seat.

## Publish on Render

1. Push these project files to your GitHub repository.
2. In Render, create a Blueprint and connect the repository. Render reads `render.yaml`; create the single web service.
3. After deployment succeeds, open the HTTPS URL Render assigns. Create a room and share the invite with another device.
4. Verify moves synchronize and a complete match ends with the correct winner.

Alternatively create a Node web service with build command `npm ci`, start command `npm start`, and health path `/health`.

No deployment has been performed by this project setup. Render account access and connecting/pushing the repository are still required. Free hosting may sleep when idle; the first request can be slow.

## Hosting limits

Run exactly one server instance. Rooms are held in memory and disappear on restarts or deployments; disconnected rooms expire after 24 hours. There is no persistent match history. Leaving a room closes your connection but does not release your reserved seat; create a new room to change opponents. Online room creation requires connectivity. The room code and seat token grant access, so only share invites with intended opponents. HTTPS is required for production.
