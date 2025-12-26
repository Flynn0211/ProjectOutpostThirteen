# 🛡️ ON-CHAIN BUNKER - Technical Documentation

> **Note**: This document focuses on the **Technical Architecture** and **Source Code Structure** of the Smart Contracts system on Sui Blockchain.

## 🎉 Latest Updates

**Version 4.0** - Full Roadmap Complete! 🚀

## 🚢 Testnet Deploy Notes (Important)

- See detailed guide: [TESTNET_README.md](TESTNET_README.md)
- The project is currently running **testnet-only**. Each `sui move publish` generates a **new PACKAGE_ID** → update `frontend/src/constants.ts` (or set `VITE_PACKAGE_ID` in `.env.local`).
- **On-chain data breaking change**: `Room` struct layout changed (added `production_remainder` field), so **old Bunker objects will be incompatible** with the new package.
  - After republishing, please **create a new bunker** via UI flow/entry `bunker::create_bunker`.
  - If frontend is loading old bunker, you might encounter parse/display errors; create a new one to test gameplay.

### Phase 4: PvP Raid System ⚔️ (NEW!)

- ✅ **Bunker Raiding**: Attack other players' bunkers to loot resources.
- ✅ **Raid Costs**: 50 Scrap + 0.1 SUI (burned) per attack.
- ✅ **Cooldown System**: 24-hour cooldown per defender, max 3 raids/day.
- ✅ **Loot System**: Attacker receives 20% of resources upon winning.
- ✅ **Home Advantage**: Defender gets +10% power.
- ✅ **Defense Rewards**: +10 Scrap for successful defense.

### Phase 3: Advanced Systems

- ✅ **Durability System**: Items decrease durability based on expedition outcomes.
- ✅ **Crafting & Blueprints**: Craft items from blueprints using Scrap.
- ✅ **Skill Tree**: 10 skills, skill points per level, respec system.

### Phase 2: Economy

- ✅ **Marketplace**: Trade NPCs, Items, Resources with 2% platform fee.

### Phase 1: Core Gameplay

- ✅ **Knockdown & Recovery System**: No more permanent death for NPCs, instead they are knocked out and can recover.
- ✅ **Multi-Slot Equipment**: 4 independent slots (weapon, armor, tool×2) instead of single slot.
- ✅ **Inventory System**: 20 slots for storing items from expeditions.
- ✅ **Item-Expedition Linking**: Item bonuses clearly impact expedition outcomes.
- ✅ **View Functions**: Full helper functions for frontend integration.

---

## 🏗️ Overall Architecture

**On-Chain Bunker** is designed following the **Object-Centric** model of Sui, fully leveraging composability and true ownership.

### Data Flow

```mermaid
graph TD
    User([User / Frontend]) -->|Transaction| SuiNetwork

    subgraph "Sui Smart Contracts"
        Recruit[Recruit NPC]
        Expedition[Start Expedition]
        Equip[Equip Item]
        Inventory[Add to Inventory]

        BunkerObj[Shared Object: Global Config / Bunker State]
        NPCObj[Owned Object: NPC]
        ItemObj[Owned Object: Item]

        Recruit -->|Creates| NPCObj
        Expedition -->|Mutates| NPCObj
        Expedition -->|Mutates| BunkerObj
        Equip -->|Attaches| ItemObj
        Equip -->|To Slot| NPCObj
        Inventory -->|Stores| ItemObj
    end

    NPCObj -->|4 Equipment Slots| EquipSlots[Weapon/Armor/Tool1/Tool2]
    NPCObj -->|20 Inventory Slots| InvSlots[inv_0 to inv_19]
    SuiNetwork -->|Events| Indexer[Frontend Indexer / Event Listener]
    Indexer -->|Updates UI| User
```

### Key Components

1.  **NPC (Non-Player Character)**:

    - Is an **Owned Object** (owned by user wallet).
    - Contains all stats: HP, Stamina, Level, Profession, Rarity.
    - **Status Tracking**: `IDLE`, `ON_MISSION`, `KNOCKED`
    - **Level & Stats** are permanent and stored on-chain.
    - **4 Equipment Slots**:
      - `slot_weapon` - 1 weapon
      - `slot_armor` - 1 armor
      - `slot_tool_1`, `slot_tool_2` - 2 tools
    - **Inventory**: 20 slots using **Dynamic Object Fields** (keys: `inv_0` to `inv_19`)

2.  **Item (Object)**:

    - Is an **Owned Object**.
    - **Clear Classification**:
      - **Equippable** (Weapon, Armor, Tool): Attach to equipment slots, boost stats.
      - **Consumable** (Medicine, Food, Water, Revival Potion): Use to recover or revive NPCs.
      - **Collectible** (Type 99): High rarity, **CANNOT BE EQUIPPED**, used for collection/trading.
    - **Bonuses**:
      - **Weapon (Attack)** → +Success Rate (5 atk = +1%)
      - **Armor (Defense/HP)** → -Damage (5 def = -1 damage)
      - **Tools (Luck)** → +Item Chance (3 luck = +1%)

3.  **Bunker**:

    - Manages player's total resources.
    - Stores resources gained from expeditions.
    - Instant recovery cost: 100 resources.

4.  **Expedition**:

    - Core logic handling the "Game Loop".
    - Calculates probability based on: Stats + Equipment Bonuses + Profession.
    - Results: Critical Success / Success / Partial Success / Failure / Critical Failure.
    - **Risk**: Critical Failure → NPC gets **Knocked Out** (no permanent death).

5.  **Recovery System**:

    - **Natural Recovery**: Wait 1 hour, recover 60% HP/Stamina.
    - **Instant Recovery**: Spend 100 resources, recover 80% HP/Stamina immediately.
    - **Revival Potion**: Revive from knocked state, restore 50% HP/Stamina.

6.  **Raid System** (Phase 4 - PvP):
    - **Shared Object**: `RaidHistory` tracks cooldowns and daily limits.
    - **Costs**: 50 Scrap + 0.1 SUI (burned) per raid.
    - **Limits**: 24h cooldown/defender, max 3 raids/day.
    - **Combat**: Simplified power (NPC count × 100 vs Bunker level × 100).
    - **Loot**: 20% resources (Food, Water, Scrap) on win.
    - **Defense**: +10% home advantage, +10 Scrap reward on win.

---

## 📂 Source Code Structure

Source code is located in `Contracts/sources/`. Here is the detailed description of each module:

### 1. `utils.move` (Utilities & Constants)

This is the foundation module, containing:

- **Constants**: Defines all game stats, rarity thresholds, professions, item types.
  - _Example_: `RARITY_MYTHIC`, `PROFESSION_MEDIC`, `RECRUIT_COST_MIST`.
- **Pseudo-Random Number Generator (PRNG)**: `generate_random_u64` and `random_in_range` functions used for on-chain probability rolls.
- **Events**: Defines important Event structures (`RecruitEvent`, `ExpeditionResultEvent`, `LevelUpEvent`, `KnockoutEvent`).
- **Helper Functions**: Stat range calculation based on rarity.

### 2. `item.move` (Item System)

Manages Item Object:

- **Struct `Item`**: Defines Item object with bonus stats (HP, Attack, Defense, Luck).
- **`create_random_item`**: Logic to create random item (rarity, type, stats) based on PRNG.
- **`destroy_item`**: Function to burn item when consumed.
- **Getters**: `get_item_type()`, `get_total_bonus()`, etc.

### 3. `npc.move` (Character System) ⭐ MAJOR UPDATES

Heart of the game, manages NPC Object:

#### Core Functions:

- **Struct `NPC`**:
  - Stats: HP, Stamina, Level, Rarity, Profession
  - Status: `status: u8`, `knocked_at: u64`
  - Inventory: `inventory_count: u64`
- **`recruit_npc`**: Mint new NPC (0.1 SUI), random stats/profession, start with IDLE status.

#### Equipment System (v2.0):

- **`equip_item`**: Auto-map item to correct slot by type.
  - Weapon → `slot_weapon`
  - Armor → `slot_armor`
  - Tool → `slot_tool_1` or `slot_tool_2` (auto-find empty)
- **`unequip_weapon/armor/tool_1/tool_2`**: Unequip from specific slots.
- **`get_equipped_bonus`**: Aggregate bonuses from ALL 4 slots.

#### Inventory System (v2.0):

- **`add_item_to_inventory`**: Add item to inventory (max 20 slots).
- **`remove_item_from_inventory`**: Remove by slot index.
- **`transfer_from_inventory`**: Transfer item to wallet.
- **`is_inventory_full`**: Check capacity.

#### Knockdown & Recovery (v2.0):

- **`knock_out`**: Set status → KNOCKED, record timestamp.
- **`recover_npc`**: Natural recovery after 1h (ownership protected).
- **`instant_recover_npc`**: Instant recovery using resources (ownership protected).
- **`revive_npc`**: Revive using Revival Potion (ownership protected).
- **`is_knocked`**, **`can_recover`**: Status checks.

#### View Functions (v2.0):

- **`get_npc_summary`**: Full info for UI (10 fields).
- **`can_go_expedition`**: Check readiness.
- **`can_equip_items`**: Check equip capability.
- **`get_recovery_time_remaining`**: Countdown timer.
- **`get_equipped_slots_count`**: Equipment counter.

#### Maintenance:

- **`level_up`**: Increase basic stats for NPC.
- **`take_damage`**: Decrease HP.
- **`consume_food`**: Eat food to recover.

### 4. `expedition.move` (Game Loop Logic) ⭐ UPDATED

Handles expedition logic with refined calculations:

- **`start_expedition`**: Main entry point.

  - Check conditions (Status = IDLE, HP > 20, Stamina > 30).
  - Deduct cost.
  - Roll result based on success_rate.

- **`calculate_success_rate`** (REFACTORED):

  ```
  Base 50% + Combat Power Bonus + Profession Bonus
  + Weapon Bonus (attack/5 = % success)
  - Duration Penalty
  = Success Rate (capped at 90%)
  ```

- **`calculate_damage`** (REFACTORED):

  ```
  Base Damage
  - Medic Profession Reduction
  - Armor Reduction ((def+hp)/5)
  = Final Damage
  ```

- **`calculate_item_chance`**:

  ```
  Base 30% + Level*2
  + Tool Bonus (luck/3 = % chance)
  = Item Chance (capped at 70%)
  ```

- **Outcome Handlers**:
  - `handle_critical_success`: Resources + Level up + No damage
  - `handle_success`: Resources + Level up + Minor damage
  - `handle_partial_success`: Some resources + Damage
  - `handle_failure`: No resources + Heavy damage
  - `handle_critical_failure`: **Knock Out** (no permanent death)

### 5. `bunker.move` (Bunker Management)

- Manages resources and bunker upgrades.
- `consume_resources`: Used for instant recovery.

### 6. `raid.move` (PvP Raid System) ⚔️ NEW!

**Phase 4 - Bunker Raiding**:

- **Struct `RaidHistory`**: Shared object tracking all raid history
  - `last_raid_times`: Cooldown tracking (24h/defender)
  - `daily_raid_counts`: Daily limit tracking (3/day/attacker)
- **`start_raid`**: Main raid function
  - Cost: 50 Scrap + 0.1 SUI (burned)
  - Combat: Simplified NPC count vs Bunker level
  - Loot: 20% resources on win
  - Events: `RaidResult` with full battle details
- **View Functions**:
  - `get_raid_cooldown_remaining`: Check cooldown
  - `get_remaining_raids_today`: Check daily limit
- **Deflationary**: SUI burned per raid → reduces supply

---

## 🔧 Developer Quick Guide

### Development Workflow

1.  **Edit Constants**: To balance game, edit in `utils.move` or consts in modules.
2.  **Add Game Logic**: Edit `expedition.move` to change game rules.
3.  **Add NPC Properties**: Edit struct `NPC` in `npc.move` (mind versioning if mainnet).

### Frontend Integration

See detailed details in file: **[FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md)** ⭐ (Updated)

### Build & Deploy

```bash
cd Contracts
sui move build      # Build success ✅
sui client publish --gas-budget 100000000
```

**Build Status:** ✅ Production-ready (Code cleaned, test functions removed)

- Total lines: ~2,400 lines of clean Move code
- Warnings: 2 minor lint warnings on deprecated functions (safe to ignore)

---

## 📊 Game Balance Summary

| Feature                    | Formula        | Example              |
| -------------------------- | -------------- | -------------------- |
| **Weapon Success Bonus**   | attack ÷ 5     | 25 atk = +5% success |
| **Armor Damage Reduction** | (def + hp) ÷ 5 | 30 def = -6 damage   |
| **Tool Item Chance**       | luck ÷ 3       | 21 luck = +7% loot   |
| **Natural Recovery**       | 1 hour wait    | 60% HP/Stamina       |
| **Instant Recovery**       | 100 resources  | 80% HP/Stamina       |
