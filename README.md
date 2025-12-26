# Project Outpost Thirteen

Project Outpost Thirteen is a small on-chain survival/bunker game on Sui:

- Move smart contracts (NPCs, items, bunker, expeditions, marketplace, raids)
- React + Vite frontend that interacts with Sui via wallet

## Repos / docs

- Contracts: [contracts_readme.md](contracts_readme.md)
- Frontend: [frontend/README.md](frontend/README.md)
- Testnet deploy + frontend sync: [contracts_readme.md](contracts_readme.md)
- Frontend ↔ contract integration notes: [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)

## Roadmap

Phases (feature-level):

- Phase 1: Core loop (NPC recruit, inventory, equipment, recovery)
- Phase 2: Economy (marketplace)
- Phase 3: Advanced systems (durability, crafting)
- Phase 4: PvP (raids)

## Current roadmap (short-term)

- Testnet iteration: publish → update IDs → validate UI flows with new objects
- Stability: reduce hard-coded IDs, improve transaction error feedback
- Cleanup: address Move lints/warnings where it improves composability
- Documentation: keep deployment notes and IDs up to date

## Known issues / pitfalls

- Republish breaks on-chain types: objects from older package versions will not decode under the new package.
- Republish also creates new shared objects (Marketplace / RaidHistory / BunkerNpcLedger): update all IDs, not only `PACKAGE_ID`.
- If the UI loads an old bunker object, you may see parsing/display errors; create a new bunker after republish.

## Tech

- Chain: Sui, Move
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Wallet/tx: Mysten dapp-kit
- Data: TanStack Query
