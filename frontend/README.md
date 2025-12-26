# Frontend (React / Vite)

Web client for Project Outpost Thirteen.

## Requirements

- Node.js 18+ recommended
- A Sui wallet in the browser (for testnet)

## Install

From this directory:

- `npm install`

## Run (dev)

- `npm run dev`

## Build

- `npm run build`

## Configuration

The app reads Sui network + contract IDs from Vite env vars. Defaults are provided in `src/constants.ts`, but for local development you should prefer `.env.local`.

Create `frontend/.env.local`:

```bash
VITE_NETWORK=testnet
VITE_PACKAGE_ID=0x...
VITE_MARKETPLACE_ID=0x...
VITE_RAID_HISTORY_ID=0x...
VITE_BUNKER_NPC_LEDGER_ID=0x...
```

Notes:

- Republish creates a new `PACKAGE_ID` and new shared object IDs; update all of them.
- After republish, old objects from previous package versions will not decode; test with freshly created NPCs/Bunkers.

## Useful docs

- Deployment / testnet workflow: [../contracts_readme.md](../contracts_readme.md)
- Frontend ↔ contract integration notes: [../FRONTEND_GUIDE.md](../FRONTEND_GUIDE.md)
