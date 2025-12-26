# 🎨 Frontend Integration Guide (On-Chain Bunker)

This document is for Frontend Developers to connect with the On-Chain Bunker Smart Contracts system on Sui.

---

## 🔑 Core Concepts

When working with Sui and `dapp-kit`, pay attention to the following Object Types:

### 1. Object Types

To query an object, you need its exact Type.
_Replace `PACKAGE_ID` with the actual package address after deployment._

| Object Name | Suffix Type        | Description                                                   |
| :---------- | :----------------- | :------------------------------------------------------------ |
| **NPC**     | `::npc::NPC`       | Main character. Owned Object.                                 |
| **Item**    | `::item::Item`     | Item. Owned Object.                                           |
| **Bunker**  | `::bunker::Bunker` | Bunker. (Can be Shared or Owned depending on implementation). |

_Example full type_: `0x123...::npc::NPC`

---

## 📡 Events (Important)

Because random logic is executed on-chain, the Frontend **CANNOT** know the result immediately from the transaction block response. You must **listen to Events** or parse Events from the Transaction Receipt.

### Required Events

**1. `RecruitEvent`** (Module: `utils`)

- **When**: Player successfully recruits an NPC.
- **Data**: `npc_id`, `rarity`, `profession`, `max_hp`, `stamina`.
- **Frontend Action**: Display popup "Congratulations! You received a [Rarity] NPC".

**2. `ExpeditionResultEvent`** (Module: `utils`)

- **When**: Expedition ends.
- **Data**: `success` (bool), `resources_gained`, `items_gained`, `damage_taken`.
- **Frontend Action**:
  - If `success = true`: Show victory screen, resources received.
  - If `success = false`: Show failure screen, health deducted.
  - **IMPORTANT**: If `damage_taken` is very large (e.g., 9999), it indicates DEATH/KNOCKOUT.

**3. `KnockoutEvent`** (Module: `utils`)

- **When**: NPC is Knocked Out due to Critical Failure.
- **Data**: `npc_id`, `rarity`, `level`, `cause`.
- **Frontend Action**: Show status "Unconscious" (HP=0). Display 3 options:
  - Use Revival Potion (if available)
  - Wait 1 hour for self-recovery (natural recovery)
  - Instant recovery (costs 100 bunker resources)

**4. `RaidResult`** (Module: `raid`) ⚔️ NEW!

- **When**: After each raid (Phase 4 - PvP)
- **Data**:
  - `attacker`, `defender`: Addresses
  - `attacker_npc_count`: Number of NPCs involved
  - `success`: bool - Whether attacker won or lost
  - `attacker_power`, `defender_power`: Combat powers
  - `food_looted`, `water_looted`, `scrap_looted`: Looted resources
  - `timestamp`: Raid time
- **Frontend Action**:
  - Show battle result with animation
  - If `success = true`: Show resources looted
  - If `success = false`: Show defense successful message
  - Update bunker resources and raid history

---

## 🎮 Interactions (Move Calls)

Use `TransactionBlock` to call functions.

### 1. Recruit NPC

- **Function**: `recruit_npc`
- **Module**: `npc`
- **Arguments**: `[Clock]`
- **Payment**: Need to split coin 0.1 SUI to pay recruit fee.
- **Note**: Pass `0x6` (Clock) as argument.

```typescript
// Example with @mysten/dapp-kit
const tx = new TransactionBlock();
const [coin] = tx.splitCoins(tx.gas, [tx.pure(100_000_000)]); // 0.1 SUI
tx.moveCall({
  target: `${PACKAGE_ID}::npc::recruit_npc`,
  arguments: [
    coin,
    tx.object("0x6"), // Clock object
  ],
});
```

### 2. Start Expedition

- **Function**: `start_expedition`
- **Module**: `expedition`
- **Arguments**:
  1. `npc`: NPC Object ID.
  2. `bunker`: Bunker Object ID.
  3. `duration`: Hours (u64).
  4. `clock`: `0x6`.

### 3. Equip Item

- **Function**: `equip_item`
- **Module**: `npc`
- **Arguments**:
  1. `npc`: NPC Object ID.
  2. `item`: Item Object ID.
  - **Note**: Cannot equip `Collectible` (Type 99), `Food` (Type 6), or `Revival Potion` (Type 5). Frontend should filter these items when showing Equip dialog.

### 4. Unequip Item (Multi-Slot System v2.0)

- **Functions**:
  - `unequip_weapon` - Unequip weapon slot
  - `unequip_armor` - Unequip armor slot
  - `unequip_tool_1` - Unequip tool slot 1
  - `unequip_tool_2` - Unequip tool slot 2
- **Module**: `npc`
- **Arguments**:
  1. `npc`: NPC Object ID.
  2. `clock`: `0x6`
- **Note**: NPC has 4 separate equipment slots. Choose function corresponding to the slot you want to unequip.

### 5. Revive NPC

- **Function**: `revive_npc`
- **Module**: `npc`
- **Arguments**:
  1. `npc`: NPC Object ID.
  2. `potion`: Revival Potion Object ID (Item Type 5).
  3. `clock`: `0x6`.

### 6. Use Food (Consume Food)

- **Function**: `consume_food`
- **Module**: `npc`
- **Arguments**:
  1. `npc`: NPC Object ID.
  2. `food`: Food Object ID (Item Type 6).
  3. `clock`: `0x6`.

### 7. Recovery & Knockout System (v2.0)

**Natural Recovery** (after 1 hour):

- **Function**: `recover_npc`
- **Module**: `npc`
- **Arguments**: `npc`, `clock`
- **Effect**: Recover 60% HP/Stamina

**Instant Recovery** (costs 100 resources):

- **Function**: `instant_recover_npc`
- **Module**: `npc`
- **Arguments**: `npc`, `bunker`, `clock`
- **Effect**: Recover 80% HP/Stamina immediately

**Check Functions**:

- `is_knocked(npc)` - Check if NPC is knocked
- `can_recover(npc, clock)` - Check if recovery time reached
- `get_recovery_time_remaining(npc, clock)` - Get remaining time (ms)

### 8. View Functions (Frontend Helpers)

**NPC Info**:

- `get_npc_summary(npc)` - Get 10 most important fields
- `can_go_expedition(npc)` - Check readiness for expedition
- `can_equip_items(npc)` - Check if can equip
- `get_equipped_slots_count(npc)` - Count occupied equipment slots

**Equipment Checks**:

- `has_weapon_equipped(npc)` - Check if weapon equipped
- `has_armor_equipped(npc)` - Check if armor equipped
- `has_tool_1_equipped(npc)` - Check tool slot 1
- `has_tool_2_equipped(npc)` - Check tool slot 2
- `get_equipped_bonus(npc)` - Get total bonuses from ALL slots

**Inventory**:

- `is_inventory_full(npc)` - Check if inventory full
- `get_inventory_count(npc)` - Number of items in inventory

---

## 🐛 Error Codes Mapping

If transaction fails, check error code:

| Error Code | Module     | Meaning                                                                                      |
| :--------- | :--------- | :------------------------------------------------------------------------------------------- |
| **400**    | expedition | `E_NPC_NOT_READY` - NPC is busy or too tired.                                                |
| **402**    | expedition | `E_INVALID_DURATION` - Invalid duration.                                                     |
| **101**    | npc        | `E_INSUFFICIENT_FUNDS` - Not enough funds to recruit.                                        |
| **105**    | npc        | `E_NOT_OWNER` - Operation on NPC/Bunker not owned by you.                                    |
| **208**    | npc        | `E_INVALID_ITEM` - Item used incorrectly (e.g., using a stick to eat for health).            |
| **209**    | npc        | `E_CANNOT_EQUIP_THIS_ITEM` - Trying to equip non-weapon/armor item (like Food, Collectible). |

---

## 📝 Suggested Frontend Workflow

1.  **Home Screen**:

    - Query all object type `NPC` owned by user.
    - Query object `Bunker`.
    - Display list. Check `current_hp` to see if any NPC is Knocked Out.

2.  **When User clicks "Recruit"**:

    - Send transaction `recruit_npc`.
    - Subscribe to `RecruitEvent` for result (new NPC ID is in event).
    - After event -> Refresh NPC list.

3.  **When User clicks "Expedition"**:
    - Let user select hours.
    - Send transaction `start_expedition`.
    - Show loading...
    - Wait for `ExpeditionResultEvent`.
    - Show result popup based on event.

---

## 🎯 Code Quality

**Version:** v4.0 (Production Ready - All Phases Complete!)

- ✅ Clean code - Test functions removed
- ✅ No duplicate code
- ✅ Comprehensive error handling
- ✅ Complete event system
- ✅ Full Vietnamese comments
- ✅ **Phase 4 - PvP Raid System** complete

---

_This document is created and updated by Antigravity Agent - Last updated: 2025-12-22_
