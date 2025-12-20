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
    use sui::clock::Clock;
    use sui::dynamic_object_field;
    use std::vector;
    use std::string::{Self, String};
    
    use contracts::utils;
    use contracts::item::{Self, Item};

    // ==================== ERROR CODES ====================
    #[allow(unused_const)]
    const E_INSUFFICIENT_PAYMENT: u64 = 200;
    const E_INVALID_STATS: u64 = 201;
    const E_NPC_DEAD: u64 = 202;
    const E_INSUFFICIENT_HP: u64 = 203; // Note: Also used when NPC is dead
    const E_INSUFFICIENT_STAMINA: u64 = 204;
    const E_ALREADY_EQUIPPED: u64 = 205;
    const E_NO_ITEM_EQUIPPED: u64 = 206;
    const E_NOT_OWNER: u64 = 207;
    const E_INVALID_ITEM: u64 = 208;
    const E_CANNOT_EQUIP_THIS_ITEM: u64 = 209;

    // ==================== CONSTANTS ====================
    const LEVEL_UP_HP_BONUS: u64 = 5;        // Mỗi level tăng 5 HP
    const LEVEL_UP_STAMINA_BONUS: u64 = 10;  // Mỗi level tăng 10 stamina
    // Note: EQUIPPED_ITEM_KEY sẽ dùng inline b"equipped_item" thay vì const vector

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
        // Dynamic field sẽ được dùng để attach equipped item
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
     * Equip item vào NPC bằng dynamic object field
     * 
     * CƠ CHẾ DYNAMIC FIELDS:
     * - Item trở thành "child object" của NPC
     * - Item vẫn là object riêng biệt, chỉ attach vào NPC
     * - Khi NPC bị destroy, item cũng bị destroy theo
     * - NPC chỉ equip được 1 item tại một thời điểm
     * 
     * CÁCH HOẠT ĐỘNG:
     * 1. Check NPC chưa có item equipped
     * 2. Add item vào NPC.id với key "equipped_item"
     * 3. Item bonuses (HP, Attack, Defense, Luck) sẽ được tính trong expedition
     * 4. Emit EquipEvent
     * 
     * LỢI ÍCH:
     * - Item không mất đi, chỉ attach vào NPC
     * - Có thể unequip và equip item khác
     * - Bonuses tự động áp dụng trong expedition
     * - **QUAN TRỌNG**: Chỉ cho phép EQUIP: Weapon (Type 1), Armor (Type 2), Tool (Type 3).
     * - **KHÔNG ĐƯỢC EQUIP**: Medicine (Type 4), Revival Potion (Type 5), Food (Type 6), Collectible (Type 99).
     * 
     * CÁCH DÙNG:
     * ```
     * // Giả sử bạn có sword: Item
     * equip_item(&mut my_npc, sword, clock, ctx);
     * // Sword giờ là child của NPC, bonuses tự động áp dụng
     * ```
     */
    public entry fun equip_item(
        npc: &mut NPC,
        item: Item,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Kiểm tra chưa có item equipped
        assert!(!dynamic_object_field::exists_(&npc.id, b"equipped_item"), E_ALREADY_EQUIPPED);
        
        // Kiểm tra item type hợp lệ để equip (Weapon, Armor, Tool)
        // Không cho equip Medicine, Revival Potion, Food, Collectible
        let item_type = item::get_item_type(&item);
        assert!(
            item_type != item::type_collectible() && 
            item_type != item::type_food() &&
            item_type != item::type_revival_potion(), // Revival potion dùng hàm revive
            E_CANNOT_EQUIP_THIS_ITEM
        );
        
        let item_id = object::id(&item);
        
        // Add item làm dynamic field của NPC
        // Key: b"equipped_item" (vector<u8>)
        // Value: Item object
        dynamic_object_field::add(&mut npc.id, b"equipped_item", item);
        
        // Emit event
        utils::emit_equip_event(
            object::uid_to_address(&npc.id),
            object::id_to_address(&item_id),
            true,  // equipped = true
            clock
        );
    }

    /**
     * Unequip item từ NPC
     * 
     * CÁCH HOẠT ĐỘNG:
     * 1. Check NPC có item equipped
     * 2. Remove item từ dynamic field
     * 3. Transfer item về cho owner
     * 4. Emit EquipEvent
     * 
     * CÁCH DÙNG:
     * ```
     * unequip_item(&mut my_npc, clock, ctx);
     * // Item sẽ được transfer về địa chỉ của bạn
     * ```
     */
    public entry fun unequip_item(
        npc: &mut NPC,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Kiểm tra có item equipped
        assert!(dynamic_object_field::exists_(&npc.id, b"equipped_item"), E_NO_ITEM_EQUIPPED);
        
        // Remove item từ dynamic field
        let item: Item = dynamic_object_field::remove(&mut npc.id, b"equipped_item");
        let item_id = object::id(&item);
        
        // Transfer item về cho owner
        transfer::public_transfer(item, npc.owner);
        
        // Emit event
        utils::emit_equip_event(
            object::uid_to_address(&npc.id),
            object::id_to_address(&item_id),
            false,  // equipped = false
            clock
        );
    }

    /**
     * Lấy tổng bonus từ equipped item (nếu có)
     * 
     * Returns: (hp_bonus, attack_bonus, defense_bonus, luck_bonus)
     * 
     * CÁCH DÙNG TRONG EXPEDITION:
     * ```
     * let (hp, atk, def, luck) = npc::get_equipped_bonus(&npc);
     * let total_bonus = hp + atk + def + luck;
     * success_rate = success_rate + (total_bonus / 10);
     * ```
     */
    public fun get_equipped_bonus(npc: &NPC): (u64, u64, u64, u64) {
        if (dynamic_object_field::exists_(&npc.id, b"equipped_item")) {
            let item = dynamic_object_field::borrow<vector<u8>, Item>(&npc.id, b"equipped_item");
            item::get_total_bonus(item)
        } else {
            (0, 0, 0, 0)
        }
    }

    /// Kiểm tra có item equipped không
    public fun has_equipped_item(npc: &NPC): bool {
        dynamic_object_field::exists_(&npc.id, b"equipped_item")
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

    // ==================== DESTROY (Permanent Death) ====================
    
    // ==================== KNOCKOUT & REVIVAL ====================
    
    /// Đánh ngất NPC (thay vì chết vĩnh viễn)
    /// Được gọi khi expedition critical failure
    public fun knock_out(npc: &mut NPC, cause: vector<u8>, clock: &Clock) {
        // Set HP về 0 để đánh dấu là bất tỉnh
        npc.current_hp = 0;
        
        let npc_id = object::uid_to_address(&npc.id);
        
        // Emit death event (frontend sẽ hiểu là Knocked Out)
        utils::emit_death_event(npc_id, npc.owner, npc.rarity, npc.level, cause, clock);
    }

    /// Hồi sinh NPC bằng Revival Potion
    public entry fun revive_npc(
        npc: &mut NPC,
        potion: Item,
        _clock: &Clock,
        _ctx: &mut TxContext
    ) {
        // Kiểm tra đúng là Revival Potion (Type 5)
        assert!(item::get_item_type(&potion) == item::type_revival_potion(), E_INVALID_ITEM);
        
        // Burn potion
        item::destroy_item(potion);
        
        // Kiểm tra NPC có thực sự chết/ngất không? (HP == 0)
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

    /// Kiểm tra NPC có còn sống không
    public fun is_alive(npc: &NPC): bool {
        npc.current_hp > 0
    }

    /// Kiểm tra NPC có đủ điều kiện cho expedition không
    public fun is_ready_for_expedition(npc: &NPC): bool {
        npc.current_hp > 20 && npc.current_stamina > 30 && npc.hunger > 20 && npc.thirst > 20
    }

    /// Tính combat power (dùng cho expedition)
    public fun get_combat_power(npc: &NPC): u64 {
        let base_power = npc.current_hp + npc.current_stamina;
        let skill_bonus = (vector::length(&npc.skills) as u64) * 10;
        let rarity_bonus = (npc.rarity as u64) * 20;
        let level_bonus = npc.level * 5;
        
        base_power + skill_bonus + rarity_bonus + level_bonus
    }
}