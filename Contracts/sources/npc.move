// Module: npc
// Mô tả: Module quản lý NPC - trung tâm của game
// NPC là owned objects với stats, có thể level up, equip items, và tham gia expeditions

#[allow(unused_const)]
module contracts::npc {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self as clock, Clock};
    use sui::dynamic_object_field;
    use std::vector;
    use std::string::{Self, String};
    
    use contracts::utils;
    use contracts::item::{Self, Item};
    use contracts::bunker;

    // ==================== ERROR CODES ====================
    #[allow(unused_const)]
    const E_INSUFFICIENT_PAYMENT: u64 = 200;

    // E_NPC_DEAD removed - không còn permanent death, dùng E_NPC_KNOCKED thay thế


    const E_ALREADY_EQUIPPED: u64 = 205;
    const E_NO_ITEM_EQUIPPED: u64 = 206;
    const E_NOT_OWNER: u64 = 207;
    const E_INVALID_ITEM: u64 = 208;
    const E_CANNOT_EQUIP_THIS_ITEM: u64 = 209;
    const E_NPC_ON_MISSION: u64 = 210;

    const E_CANNOT_RECOVER_YET: u64 = 212;
    const E_INVENTORY_FULL: u64 = 213;
    const E_ITEM_NOT_FOUND: u64 = 214;
    const E_INVALID_STATUS: u64 = 215;

    // ==================== CONSTANTS ====================
    
    // NPC Status
    const STATUS_IDLE: u8 = 0;
    const STATUS_ON_MISSION: u8 = 1;
    const STATUS_KNOCKED: u8 = 2;
    
    // Recovery Constants
    const RECOVERY_TIME_MS: u64 = 3600000;      // 1 giờ = 3,600,000 ms
    const RECOVERY_RESOURCE_COST: u64 = 100;    // Chi phí resource để instant recovery
    
    // Equipment Slots: NPC có 4 slots: 1 weapon, 1 armor, 2 tools
    // Slot keys sẽ dùng inline: b"slot_weapon", b"slot_armor", b"slot_tool_1", b"slot_tool_2"
    // Item types mapping:
    // - TYPE_WEAPON (1) -> slot_weapon
    // - TYPE_ARMOR (2) -> slot_armor
    // - TYPE_TOOL (3) -> slot_tool_1 hoặc slot_tool_2
    
    // Inventory System
    // Items trong inventory được lưu bằng dynamic fields với key: b"inv_0", b"inv_1", ... b"inv_19"
    // NPC struct tracks inventory_count để biết có bao nhiêu items
    const MAX_INVENTORY_SLOTS: u64 = 20;  // Tối đa 20 items trong inventory
    
    // Level Up Bonuses
    const LEVEL_UP_HP_BONUS: u64 = 5;        // Mỗi level tăng 5 HP
    const LEVEL_UP_STAMINA_BONUS: u64 = 10;  // Mỗi level tăng 10 stamina
    
    // Note: Old single slot key b"equipped_item" sẽ được deprecated

    // ==================== STRUCT ====================
    
    /// NPC object - Nhân vật sinh tồn trong bunker
    /// Owned object, có thể trade, level up, equip items
    public struct NPC has key, store {
        id: UID,
        rarity: u8,           // 0-5: Common -> Mythic
        profession: u8,       // 0-4: Scavenger, Engineer, Medic, Guard, Trader
        level: u64,           // Level hiện tại (bắt đầu từ 1)
        max_hp: u64,          // HP tối đa
        current_hp: u64,      // HP hiện tại
        max_stamina: u64,     // Stamina tối đa
        current_stamina: u64, // Stamina hiện tại
        hunger: u64,          // Độ đói (0-100, 100 = no đủ)
        thirst: u64,          // Độ khát (0-100, 100 = no đủ)
        skills: vector<u8>,   // Danh sách skill IDs
        owner: address,       // Địa chỉ chủ sở hữu
        name: String,         // Tên NPC (có thể đặt sau)
        status: u8,           // Trạng thái: IDLE/ON_MISSION/KNOCKED
        knocked_at: u64,      // Timestamp bị knocked (0 nếu không knocked)
        inventory_count: u64, // Số lượng items trong inventory (0-20)
        // Dynamic field sẽ được dùng để attach equipped items và inventory items
    }

    // ==================== RECRUITMENT ====================
    
    /**
     * Recruit NPC mới - Tốn 0.1 SUI
     * 
     * QUY TRÌNH:
     * 1. Player gửi 0.1 SUI (100_000_000 MIST) làm phí recruit
     * 2. Contract roll rarity ngẫu nhiên (70% Common -> 0.1% Mythic)
     * 3. Contract roll profession ngẫu nhiên (5 nghề)
     * 4. Contract roll stats dựa trên rarity (HP, Stamina)
     * 5. Contract tạo skills dựa trên profession và rarity
     * 6. Tạo NPC object và transfer cho player
     * 7. Emit RecruitEvent để frontend track
     * 
     * STATS THEO RARITY:
     * - Common:    HP 80-100,  Stamina 80-100,  1 skill
     * - Uncommon:  HP 100-110, Stamina 100-110, 1 skill
     * - Rare:      HP 110-130, Stamina 110-130, 2 skills
     * - Epic:      HP 140-170, Stamina 140-170, 3 skills
     * - Legendary: HP 180-220, Stamina 180-220, 4 skills
     * - Mythic:    HP 230-280, Stamina 230-280, 4 skills
     * 
     * 5 PROFESSIONS:
     * - Scavenger (0): +10% success trong expedition
     * - Engineer (1):  Bonus bunker efficiency
     * - Medic (2):     -5 damage trong expedition
     * - Guard (3):     +5% critical success
     * - Trader (4):    Bonus khi trade
     * 
     * CÁCH DÙNG:
     * ```
     * // Tạo Coin<SUI> với 0.1 SUI
     * let payment = coin::split(&mut my_sui, 100_000_000, ctx);
     * recruit_npc(payment, clock, ctx);
     * // NPC mới sẽ được transfer về địa chỉ của bạn
     * ```
     */
    public entry fun recruit_npc(
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // 1. Kiểm tra thanh toán đủ 0.1 SUI (100_000_000 MIST)
        let amount = coin::value(&payment);
        assert!(amount >= utils::recruit_cost(), E_INSUFFICIENT_PAYMENT);
        
        // 2. Burn payment (transfer về địa chỉ 0x0)
        // Note: Trong production có thể transfer vào treasury
        transfer::public_transfer(payment, @0x0);
        
        // 3. Roll rarity on-chain (100% trong contract, không gian lận được)
        let rarity = utils::roll_rarity(clock, ctx);
        
        // 4. Roll profession on-chain
        let profession = utils::roll_profession(clock, ctx);
        
        // 5. Roll stats dựa trên rarity
        let max_hp = utils::roll_stat_for_rarity(rarity, true, clock, ctx);
        let max_stamina = utils::roll_stat_for_rarity(rarity, false, clock, ctx);
        
        // 6. Tạo skills dựa trên profession và rarity
        let skills = generate_skills(profession, rarity, clock, ctx);
        
        // 7. Tạo NPC object
        let sender = tx_context::sender(ctx);
        let npc = NPC {
            id: object::new(ctx),
            rarity,
            profession,
            level: 1,                    // Bắt đầu level 1
            max_hp,
            current_hp: max_hp,          // Full HP lúc tạo
            max_stamina,
            current_stamina: max_stamina, // Full stamina lúc tạo
            hunger: 100,                  // Đủ no
            thirst: 100,                  // Đủ nước
            skills,
            owner: sender,
            name: string::utf8(b"Survivor"), // Tên mặc định, có thể đổi sau
            status: STATUS_IDLE,         // Bắt đầu ở trạng thái IDLE
            knocked_at: 0,                // Chưa bị knocked
            inventory_count: 0,           // Inventory trống
        };
        
        let npc_id = object::uid_to_address(&npc.id);
        
        // 8. Emit event để frontend listen
        utils::emit_recruit_event(
            npc_id,
            sender,
            rarity,
            profession,
            max_hp,
            max_stamina,
            clock
        );
        
        // 9. Transfer NPC cho người chơi (owned object)
        transfer::public_transfer(npc, sender);
    }

    /// Generate skills cho NPC dựa trên profession và rarity
    fun generate_skills(profession: u8, rarity: u8, clock: &Clock, ctx: &mut TxContext): vector<u8> {
        let mut skills = vector::empty<u8>();
        let num_skills = utils::get_skill_slots_for_rarity(rarity);
        
        // Skill đầu tiên dựa trên profession
        let primary_skill = profession * 10; // Ví dụ: Scavenger = 0, skills 0-9
        vector::push_back(&mut skills, primary_skill);
        
        // Các skills còn lại random
        let mut i = 1;
        while (i < num_skills) {
            let random_skill = (utils::random_in_range(0, 49, clock, ctx) as u8);
            vector::push_back(&mut skills, random_skill);
            i = i + 1;
        };
        
        skills
    }

    // ==================== LEVEL UP ====================
    
    /// Level up NPC - Tăng stats vĩnh viễn
    /// Được gọi sau khi expedition thành công
    public fun level_up(npc: &mut NPC, clock: &Clock) {
        npc.level = npc.level + 1;
        npc.max_hp = npc.max_hp + LEVEL_UP_HP_BONUS;
        npc.max_stamina = npc.max_stamina + LEVEL_UP_STAMINA_BONUS;
        
        // Heal một phần khi level up
        npc.current_hp = if (npc.current_hp + LEVEL_UP_HP_BONUS > npc.max_hp) {
            npc.max_hp
        } else {
            npc.current_hp + LEVEL_UP_HP_BONUS
        };
        
        npc.current_stamina = if (npc.current_stamina + LEVEL_UP_STAMINA_BONUS > npc.max_stamina) {
            npc.max_stamina
        } else {
            npc.current_stamina + LEVEL_UP_STAMINA_BONUS
        };
        
        // Emit event
        utils::emit_level_up_event(
            object::uid_to_address(&npc.id),
            npc.owner,
            npc.level,
            npc.max_hp,
            npc.max_stamina,
            clock
        );
    }

    // ==================== EQUIPMENT SYSTEM (Dynamic Fields) ====================
    
    /**
     * Equip item vào NPC bằng multi-slot system
     * 
     * MULTI-SLOT SYSTEM:
     * - NPC có 4 slots: 1 weapon, 1 armor, 2 tools
     * - Weapon (type 1) -> slot_weapon
     * - Armor (type 2) -> slot_armor
     * - Tool (type 3) -> slot_tool_1 hoặc slot_tool_2 (tìm slot trống)
     * 
     * CÁCH HOẠT ĐỘNG:
     * 1. Check NPC status phải IDLE
     * 2. Xác định slot dựa trên item type
     * 3. Check slot chưa occupied
     * 4. Add item vào slot bằng dynamic field
     * 5. Emit EquipEvent
     * 
     * **QUAN TRỌNG**: Chỉ cho phép EQUIP: Weapon (Type 1), Armor (Type 2), Tool (Type 3).
     * **KHÔNG ĐƯỢC EQUIP**: Medicine, Revival Potion, Food, Collectible.
     */
    public entry fun equip_item(
        npc: &mut NPC,
        item: Item,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Kiểm tra NPC không được ON_MISSION hoặc KNOCKED
        assert!(npc.status == STATUS_IDLE, E_NPC_ON_MISSION);
        
        // Kiểm tra item type hợp lệ để equip (Weapon, Armor, Tool)
        let item_type = item::get_item_type(&item);
        assert!(
            item_type != item::type_collectible() && 
            item_type != item::type_food() &&
            item_type != item::type_revival_potion(),
            E_CANNOT_EQUIP_THIS_ITEM
        );
        
        // Xác định slot key dựa trên item type
        // TYPE_WEAPON = 1, TYPE_ARMOR = 2, TYPE_TOOL = 3 (theo item.move)
        let slot_key = if (item_type == 1) {
            // Weapon
            assert!(!dynamic_object_field::exists_(&npc.id, b"slot_weapon"), E_ALREADY_EQUIPPED);
            b"slot_weapon"
        } else if (item_type == 2) {
            // Armor
            assert!(!dynamic_object_field::exists_(&npc.id, b"slot_armor"), E_ALREADY_EQUIPPED);
            b"slot_armor"
        } else {
            // Tool - tìm slot trống
            if (!dynamic_object_field::exists_(&npc.id, b"slot_tool_1")) {
                b"slot_tool_1"
            } else if (!dynamic_object_field::exists_(&npc.id, b"slot_tool_2")) {
                b"slot_tool_2"
            } else {
                // Cả 2 tool slots đã đầy
                abort E_ALREADY_EQUIPPED
            }
        };
        
        let item_id = object::id(&item);
        
        // Add item vào slot
        dynamic_object_field::add(&mut npc.id, slot_key, item);
        
        // Emit event
        utils::emit_equip_event(
            object::uid_to_address(&npc.id),
            object::id_to_address(&item_id),
            true,  // equipped = true
            clock
        );
    }

    /**
     * DEPRECATED: Sử dụng unequip_item_by_slot() thay thế
     * Function này giữ lại để backward compatibility nhưng sẽ fail
     * vì đã chuyển sang multi-slot system
     */
    public entry fun unequip_item(
        npc: &mut NPC,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Deprecated - chuyển sang dùng unequip_weapon/armor/tool functions
        abort E_NO_ITEM_EQUIPPED
    }
    
    /**
     * Unequip item từ slot cụ thể
     * 
     * CÁCH DÙNG:
     * ```
     * // Unequip weapon
     * unequip_item_by_slot(&mut npc, b"slot_weapon", clock, ctx);
     * ```
     */
    public entry fun unequip_item_by_slot(
        npc: &mut NPC,
        slot_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Kiểm tra có item trong slot
        assert!(dynamic_object_field::exists_(&npc.id, slot_key), E_NO_ITEM_EQUIPPED);
        
        // Remove item từ slot
        let item: Item = dynamic_object_field::remove(&mut npc.id, slot_key);
        let item_id = object::id(&item);
        
        // Transfer về owner
        transfer::public_transfer(item, npc.owner);
        
        // Emit event
        utils::emit_equip_event(
            object::uid_to_address(&npc.id),
            object::id_to_address(&item_id),
            false,
            clock
        );
    }
    
    /// Unequip weapon
    public entry fun unequip_weapon(npc: &mut NPC, clock: &Clock, ctx: &mut TxContext) {
        unequip_item_by_slot(npc, b"slot_weapon", clock, ctx);
    }
    
    /// Unequip armor
    public entry fun unequip_armor(npc: &mut NPC, clock: &Clock, ctx: &mut TxContext) {
        unequip_item_by_slot(npc, b"slot_armor", clock, ctx);
    }
    
    /// Unequip tool from slot 1
    public entry fun unequip_tool_1(npc: &mut NPC, clock: &Clock, ctx: &mut TxContext) {
        unequip_item_by_slot(npc, b"slot_tool_1", clock, ctx);
    }
    
    /// Unequip tool from slot 2
    public entry fun unequip_tool_2(npc: &mut NPC, clock: &Clock, ctx: &mut TxContext) {
        unequip_item_by_slot(npc, b"slot_tool_2", clock, ctx);
    }

    /**
     * Lấy tổng bonus từ TẤT CẢ equipped items
     * 
     * Returns: (hp_bonus, attack_bonus, defense_bonus, luck_bonus)
     * 
     * CÁCH HOẠT ĐỘNG:
     * - Loop qua 4 slots: weapon, armor, tool_1, tool_2
     * - Tổng hợp bonuses từ các items equipped
     * 
     * CÁCH DÙNG TRONG EXPEDITION:
     * ```
     * let (hp, atk, def, luck) = npc::get_equipped_bonus(&npc);
     * success_rate = success_rate + (atk / 10);
     * ```
     */
    public fun get_equipped_bonus(npc: &NPC): (u64, u64, u64, u64) {
        let mut total_hp = 0;
        let mut total_atk = 0;
        let mut total_def = 0;
        let mut total_luck = 0;
        
        // Check weapon slot
        if (dynamic_object_field::exists_(&npc.id, b"slot_weapon")) {
            let item = dynamic_object_field::borrow<vector<u8>, Item>(&npc.id, b"slot_weapon");
            let (hp, atk, def, luck) = item::get_total_bonus(item);
            total_hp = total_hp + hp;
            total_atk = total_atk + atk;
            total_def = total_def + def;
            total_luck = total_luck + luck;
        };
        
        // Check armor slot
        if (dynamic_object_field::exists_(&npc.id, b"slot_armor")) {
            let item = dynamic_object_field::borrow<vector<u8>, Item>(&npc.id, b"slot_armor");
            let (hp, atk, def, luck) = item::get_total_bonus(item);
            total_hp = total_hp + hp;
            total_atk = total_atk + atk;
            total_def = total_def + def;
            total_luck = total_luck + luck;
        };
        
        // Check tool_1 slot
        if (dynamic_object_field::exists_(&npc.id, b"slot_tool_1")) {
            let item = dynamic_object_field::borrow<vector<u8>, Item>(&npc.id, b"slot_tool_1");
            let (hp, atk, def, luck) = item::get_total_bonus(item);
            total_hp = total_hp + hp;
            total_atk = total_atk + atk;
            total_def = total_def + def;
            total_luck = total_luck + luck;
        };
        
        // Check tool_2 slot
        if (dynamic_object_field::exists_(&npc.id, b"slot_tool_2")) {
            let item = dynamic_object_field::borrow<vector<u8>, Item>(&npc.id, b"slot_tool_2");
            let (hp, atk, def, luck) = item::get_total_bonus(item);
            total_hp = total_hp + hp;
            total_atk = total_atk + atk;
            total_def = total_def + def;
            total_luck = total_luck + luck;
        };
        
        (total_hp, total_atk, total_def, total_luck)
    }

    /// Kiểm tra có bất kỳ item nào equipped trong bất kỳ slot nào
    public fun has_equipped_item(npc: &NPC): bool {
        dynamic_object_field::exists_(&npc.id, b"slot_weapon") ||
        dynamic_object_field::exists_(&npc.id, b"slot_armor") ||
        dynamic_object_field::exists_(&npc.id, b"slot_tool_1") ||
        dynamic_object_field::exists_(&npc.id, b"slot_tool_2")
    }
    
    /// Kiểm tra có weapon equipped không
    public fun has_weapon_equipped(npc: &NPC): bool {
        dynamic_object_field::exists_(&npc.id, b"slot_weapon")
    }
    
    /// Kiểm tra có armor equipped không
    public fun has_armor_equipped(npc: &NPC): bool {
        dynamic_object_field::exists_(&npc.id, b"slot_armor")
    }
    
    /// Kiểm tra có tool trong slot cụ thể không
    public fun has_tool_1_equipped(npc: &NPC): bool {
        dynamic_object_field::exists_(&npc.id, b"slot_tool_1")
    }
    
    public fun has_tool_2_equipped(npc: &NPC): bool {
        dynamic_object_field::exists_(&npc.id, b"slot_tool_2")
    }

    // ==================== INVENTORY SYSTEM ====================
    
    /// Kiểm tra inventory đã đầy chưa
    public fun is_inventory_full(npc: &NPC): bool {
        npc.inventory_count >= MAX_INVENTORY_SLOTS
    }
    
    /// Lấy số lượng items trong inventory
    public fun get_inventory_count(npc: &NPC): u64 {
        npc.inventory_count
    }
    
    /**
     * Thêm item vào inventory (không phải equip slot)
     * Items trong inventory không cho bonuses, chỉ lưu trữ
     */
    public fun add_item_to_inventory(npc: &mut NPC, item: Item) {
        assert!(!is_inventory_full(npc), E_INVENTORY_FULL);
        
        // Tìm slot trống
        let mut slot_index = 0;
        while (slot_index < MAX_INVENTORY_SLOTS) {
            let slot_key = make_inventory_key(slot_index);
            
            if (!dynamic_object_field::exists_(&npc.id, slot_key)) {
                dynamic_object_field::add(&mut npc.id, slot_key, item);
                npc.inventory_count = npc.inventory_count + 1;
                return
            };
            
            slot_index = slot_index + 1;
        };
        
        abort E_INVENTORY_FULL
    }
    
    /// Remove item từ inventory slot
    public fun remove_item_from_inventory(npc: &mut NPC, slot_index: u64): Item {
        assert!(slot_index < MAX_INVENTORY_SLOTS, E_ITEM_NOT_FOUND);
        
        let slot_key = make_inventory_key(slot_index);
        assert!(dynamic_object_field::exists_(&npc.id, slot_key), E_ITEM_NOT_FOUND);
        
        let item: Item = dynamic_object_field::remove(&mut npc.id, slot_key);
        npc.inventory_count = npc.inventory_count - 1;
        
        item
    }
    
    /// Entry function: transfer item từ inventory về owner
    public entry fun transfer_from_inventory(
        npc: &mut NPC,
        slot_index: u64,
        ctx: &mut TxContext
    ) {
        let item = remove_item_from_inventory(npc, slot_index);
        transfer::public_transfer(item, npc.owner);
    }
    
    /// Helper: make inventory key
    fun make_inventory_key(index: u64): vector<u8> {
        if (index == 0) { b"inv_0" }
        else if (index == 1) { b"inv_1" }
        else if (index == 2) { b"inv_2" }
        else if (index == 3) { b"inv_3" }
        else if (index == 4) { b"inv_4" }
        else if (index == 5) { b"inv_5" }
        else if (index == 6) { b"inv_6" }
        else if (index == 7) { b"inv_7" }
        else if (index == 8) { b"inv_8" }
        else if (index == 9) { b"inv_9" }
        else if (index == 10) { b"inv_10" }
        else if (index == 11) { b"inv_11" }
        else if (index == 12) { b"inv_12" }
        else if (index == 13) { b"inv_13" }
        else if (index == 14) { b"inv_14" }
        else if (index == 15) { b"inv_15" }
        else if (index == 16) { b"inv_16" }
        else if (index == 17) { b"inv_17" }
        else if (index == 18) { b"inv_18" }
        else if (index == 19) { b"inv_19" }
        else { b"inv_invalid" }
    }

    // ==================== MAINTENANCE ====================
    
    /// Hồi HP cho NPC
    public entry fun heal_npc(npc: &mut NPC, amount: u64) {
        npc.current_hp = if (npc.current_hp + amount > npc.max_hp) {
            npc.max_hp
        } else {
            npc.current_hp + amount
        };
    }

    /// Giảm HP (từ combat hoặc expedition)
    public fun take_damage(npc: &mut NPC, damage: u64) {
        if (npc.current_hp > damage) {
            npc.current_hp = npc.current_hp - damage;
        } else {
            npc.current_hp = 0;
        };
    }

    /// Hồi stamina
    public entry fun restore_stamina(npc: &mut NPC, amount: u64) {
        npc.current_stamina = if (npc.current_stamina + amount > npc.max_stamina) {
            npc.max_stamina
        } else {
            npc.current_stamina + amount
        };
    }

    /// Giảm stamina (từ expedition hoặc work)
    public fun consume_stamina(npc: &mut NPC, amount: u64) {
        if (npc.current_stamina > amount) {
            npc.current_stamina = npc.current_stamina - amount;
        } else {
            npc.current_stamina = 0;
        };
    }

    /// Feed NPC (tăng hunger)
    public entry fun feed_npc(npc: &mut NPC, amount: u64) {
        npc.hunger = if (npc.hunger + amount > 100) {
            100
        } else {
            npc.hunger + amount
        };
    }

    /// Give water (tăng thirst)
    public entry fun give_water(npc: &mut NPC, amount: u64) {
        npc.thirst = if (npc.thirst + amount > 100) {
            100
        } else {
            npc.thirst + amount
        };
    }

    /// Giảm hunger và thirst theo thời gian
    public fun decrease_needs(npc: &mut NPC, hunger_loss: u64, thirst_loss: u64) {
        if (npc.hunger > hunger_loss) {
            npc.hunger = npc.hunger - hunger_loss;
        } else {
            npc.hunger = 0;
        };
        
        if (npc.thirst > thirst_loss) {
            npc.thirst = npc.thirst - thirst_loss;
        } else {
            npc.thirst = 0;
        };
    }

    /// Rename NPC
    public entry fun rename_npc(npc: &mut NPC, new_name: vector<u8>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == npc.owner, E_NOT_OWNER);
        npc.name = string::utf8(new_name);
    }


    
    // ==================== KNOCKOUT & REVIVAL ====================
    
    /// Đánh ngất NPC (thay vì chết vĩnh viễn)
    /// Được gọi khi expedition critical failure
    public fun knock_out(npc: &mut NPC, cause: vector<u8>, clock: &Clock) {
        // Set HP về 0 để đánh dấu là bất tỉnh
        npc.current_hp = 0;
        
        // Set status sang KNOCKED và lưu timestamp
        npc.status = STATUS_KNOCKED;
        npc.knocked_at = clock::timestamp_ms(clock);
        
        let npc_id = object::uid_to_address(&npc.id);
        
        // Emit knockout event để frontend track
        utils::emit_knockout_event(npc_id, npc.owner, npc.rarity, npc.level, cause, clock);
    }

    /// Hồi sinh NPC bằng Revival Potion
    public entry fun revive_npc(
        npc: &mut NPC,
        potion: Item,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Kiểm tra ownership
        assert!(tx_context::sender(ctx) == npc.owner, E_NOT_OWNER);
        
        // Kiểm tra đúng là Revival Potion (Type 5)
        assert!(item::get_item_type(&potion) == item::type_revival_potion(), E_INVALID_ITEM);
        
        // Burn potion
        item::destroy_item(potion);
        
        // Kiểm tra NPC có thực sự knocked không? (HP == 0)
        // Nếu còn sống vẫn cho dùng để hồi full HP? -> Logic game design.
        // Ở đây ta cho phép dùng bất cứ lúc nào để hồi phục, nhưng chủ yếu là cứu sống.
        
        // Hồi sinh 50% HP + 50% Stamina
        let revive_hp = npc.max_hp / 2;
        let revive_stamina = npc.max_stamina / 2;
        
        // Nếu đang 0 HP thì set HP mới
        if (npc.current_hp == 0) {
            npc.current_hp = revive_hp;
        } else {
            // Nếu còn sống thì cộng thêm
             npc.current_hp = if (npc.current_hp + revive_hp > npc.max_hp) { npc.max_hp } else { npc.current_hp + revive_hp };
        };
        
        npc.current_stamina = if (npc.current_stamina + revive_stamina > npc.max_stamina) { npc.max_stamina } else { npc.current_stamina + revive_stamina };
        
        // Reset status về IDLE nếu đang knocked
        if (is_knocked(npc)) {
            npc.status = STATUS_IDLE;
            npc.knocked_at = 0;
        };
        
        // Emit event? Có thể dùng Heal event hoặc tạo ReviveEvent riêng. 
        // Hiện tại dùng log đơn giản hoặc reuse mechanics.
    }

    /// Ăn Food để hồi phục (HP, Stamina, Hunger)
    public entry fun consume_food(
        npc: &mut NPC,
        food: Item,
        _clock: &Clock // unused for now but good for future events
    ) {
        // Kiểm tra đúng là Food (Type 6)
        assert!(item::get_item_type(&food) == item::type_food(), E_INVALID_ITEM);
        
        // Burn item
        item::destroy_item(food);
        
        // Logic hồi phục basic
        heal_npc(npc, 20);
        restore_stamina(npc, 20);
        feed_npc(npc, 50);
    }
    
    /// Dùng Medicine để hồi HP và Stamina
    public entry fun consume_medicine(
        npc: &mut NPC,
        medicine: Item,
        _clock: &Clock
    ) {
        // Kiểm tra đúng là Medicine (dùng type_medicine constant)
        assert!(item::get_item_type(&medicine) == item::type_medicine(), E_INVALID_ITEM);
        
        // Lấy rarity để tính healing amount
        let rarity = item::get_rarity(&medicine);
        let heal_amount = if (rarity == 1) { 30 }      // Common
                         else if (rarity == 2) { 60 }   // Rare  
                         else if (rarity == 3) { 100 }  // Epic
                         else { 150 };                   // Legendary
        
        // Burn medicine
        item::destroy_item(medicine);
        
        // Hồi HP và Stamina
        heal_npc(npc, heal_amount);
        restore_stamina(npc, heal_amount);
    }
    
    /// Entry function: Add item vào inventory (dành cho frontend/player)
    public entry fun add_item_to_inventory_entry(
        npc: &mut NPC,
        item: Item,
        ctx: &mut TxContext
    ) {
        // Kiểm tra ownership
        assert!(tx_context::sender(ctx) == npc.owner, E_NOT_OWNER);
        
        // Add vào inventory
        add_item_to_inventory(npc, item);
    }

    // ==================== KNOCKDOWN RECOVERY SYSTEM ====================
    
    /// Internal: Set status cho NPC
    fun set_status(npc: &mut NPC, new_status: u8) {
        npc.status = new_status;
    }
    
    /// Kiểm tra NPC có đang bị knocked không
    public fun is_knocked(npc: &NPC): bool {
        npc.status == STATUS_KNOCKED
    }
    
    /// Kiểm tra NPC có thể recover tự nhiên không (đã đủ thời gian)
    public fun can_recover(npc: &NPC, clock: &Clock): bool {
        if (!is_knocked(npc)) {
            return false
        };
        
        let current_time = clock::timestamp_ms(clock);
        let elapsed = current_time - npc.knocked_at;
        
        elapsed >= RECOVERY_TIME_MS
    }
    
    /// Recover tự nhiên sau khi đủ thời gian
    public entry fun recover_npc(
        npc: &mut NPC,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Kiểm tra ownership
        assert!(tx_context::sender(ctx) == npc.owner, E_NOT_OWNER);
        
        // Kiểm tra đang knocked
        assert!(is_knocked(npc), E_INVALID_STATUS);
        
        // Kiểm tra đã đủ thời gian
        assert!(can_recover(npc, clock), E_CANNOT_RECOVER_YET);
        
        // Hồi phục: set status về IDLE, reset knocked_at, hồi 60% HP
        npc.status = STATUS_IDLE;
        npc.knocked_at = 0;
        npc.current_hp = (npc.max_hp * 60) / 100;
        npc.current_stamina = (npc.max_stamina * 60) / 100;
        
        // Có thể emit recovery event nếu cần (hiện tại skip)
    }
    
    /// Instant recovery bằng bunker resources
    public entry fun instant_recover_npc(
        npc: &mut NPC,
        bunker: &mut bunker::Bunker,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // CRITICAL: Kiểm tra ownership - NPC và Bunker phải cùng owner và là sender
        assert!(sender == npc.owner, E_NOT_OWNER);
        assert!(sender == bunker::get_owner(bunker), E_NOT_OWNER);
        
        // Kiểm tra đang knocked
        assert!(is_knocked(npc), E_INVALID_STATUS);
        
        // Consume resources từ bunker
        bunker::consume_resources(bunker, RECOVERY_RESOURCE_COST);
        
        // Hồi phục: set status về IDLE, reset knocked_at, hồi 80% HP
        npc.status = STATUS_IDLE;
        npc.knocked_at = 0;
        npc.current_hp = (npc.max_hp * 80) / 100;
        npc.current_stamina = (npc.max_stamina * 80) / 100;
        
        // Có thể emit recovery event
    }

    // ==================== GETTERS ====================
    
    public fun get_id(npc: &NPC): address {
        object::uid_to_address(&npc.id)
    }

    public fun get_rarity(npc: &NPC): u8 {
        npc.rarity
    }

    public fun get_profession(npc: &NPC): u8 {
        npc.profession
    }

    public fun get_level(npc: &NPC): u64 {
        npc.level
    }

    public fun get_max_hp(npc: &NPC): u64 {
        npc.max_hp
    }

    public fun get_current_hp(npc: &NPC): u64 {
        npc.current_hp
    }

    public fun get_max_stamina(npc: &NPC): u64 {
        npc.max_stamina
    }

    public fun get_current_stamina(npc: &NPC): u64 {
        npc.current_stamina
    }

    public fun get_hunger(npc: &NPC): u64 {
        npc.hunger
    }

    public fun get_thirst(npc: &NPC): u64 {
        npc.thirst
    }

    public fun get_skills(npc: &NPC): vector<u8> {
        npc.skills
    }

    public fun get_owner(npc: &NPC): address {
        npc.owner
    }

    public fun get_name(npc: &NPC): String {
        npc.name
    }
    
    public fun get_status(npc: &NPC): u8 {
        npc.status
    }
    
    public fun get_knocked_at(npc: &NPC): u64 {
        npc.knocked_at
    }

    /// Kiểm tra NPC có còn sống không
    public fun is_alive(npc: &NPC): bool {
        npc.current_hp > 0
    }

    /// Kiểm tra NPC có đủ điều kiện cho expedition không
    public fun is_ready_for_expedition(npc: &NPC): bool {
        // Phải ở trạng thái IDLE và có đủ HP, stamina, hunger, thirst
        npc.status == STATUS_IDLE && 
        npc.current_hp > 20 && 
        npc.current_stamina > 30 && 
        npc.hunger > 20 && 
        npc.thirst > 20
    }

    /// Tính combat power (dùng cho expedition)
    public fun get_combat_power(npc: &NPC): u64 {
        let base_power = npc.current_hp + npc.current_stamina;
        let skill_bonus = (vector::length(&npc.skills) as u64) * 10;
        let rarity_bonus = (npc.rarity as u64) * 20;
        let level_bonus = npc.level * 5;
        
        base_power + skill_bonus + rarity_bonus + level_bonus
    }
    
    // ==================== VIEW FUNCTIONS (Frontend helpers) ====================
    
    /// Get full NPC summary cho UI display
    public fun get_npc_summary(npc: &NPC): (
        address,  // id
        u8,       // rarity
        u8,       // profession  
        u64,      // level
        u64,      // current_hp
        u64,      // max_hp
        u64,      // current_stamina
        u64,      // max_stamina
        u8,       // status
        u64       // inventory_count
    ) {
        (
            object::uid_to_address(&npc.id),
            npc.rarity,
            npc.profession,
            npc.level,
            npc.current_hp,
            npc.max_hp,
            npc.current_stamina,
            npc.max_stamina,
            npc.status,
            npc.inventory_count
        )
    }
    
    /// Check if NPC can perform specific actions
    public fun can_go_expedition(npc: &NPC): bool {
        npc.status == STATUS_IDLE && 
        npc.current_hp > 20 && 
        npc.current_stamina > 30 &&
        npc.hunger > 20 &&
        npc.thirst > 20
    }
    
    /// Check if NPC can equip items
    public fun can_equip_items(npc: &NPC): bool {
        npc.status == STATUS_IDLE
    }
    
    /// Get recovery time remaining (in ms, 0 if not knocked or can recover)
    public fun get_recovery_time_remaining(npc: &NPC, clock: &Clock): u64 {
        if (!is_knocked(npc)) {
            return 0
        };
        
        let current_time = clock::timestamp_ms(clock);
        let elapsed = current_time - npc.knocked_at;
        
        if (elapsed >= RECOVERY_TIME_MS) {
            0
        } else {
            RECOVERY_TIME_MS - elapsed
        }
    }
    
    /// Get status as human-readable value (0=IDLE, 1=ON_MISSION, 2=KNOCKED)
    public fun get_status_value(npc: &NPC): u8 {
        npc.status
    }
    
    /// Check how many equipment slots are used
    public fun get_equipped_slots_count(npc: &NPC): u64 {
        let mut count = 0;
        
        if (dynamic_object_field::exists_(&npc.id, b"slot_weapon")) { count = count + 1 };
        if (dynamic_object_field::exists_(&npc.id, b"slot_armor")) { count = count + 1 };
        if (dynamic_object_field::exists_(&npc.id, b"slot_tool_1")) { count = count + 1 };
        if (dynamic_object_field::exists_(&npc.id, b"slot_tool_2")) { count = count + 1 };
        
        count
    }
}