// Module: crafting
// Mô tả: Phase 3 - Crafting & Blueprint System
// Cho phép craft items từ blueprints

module contracts::crafting {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::clock::Clock;
    use std::option::{Self as option, Option};
    
    use contracts::utils;
    use contracts::item;
    use contracts::bunker::{Self, Bunker};
    
    // ==================== MÃ LỖI ====================
    const E_BLUEPRINT_EXHAUSTED: u64 = 1100;        // Blueprint đã hết lượt dùng
    const E_INSUFFICIENT_SCRAP: u64 = 1101;         // Không đủ phế liệu
    const E_NOT_OWNER: u64 = 1103;                  // Không phải chủ sở hữu
    const E_BLUEPRINT_NOT_EXHAUSTED: u64 = 1104;    // Blueprint chưa hết (không thể xóa)
    const E_INVALID_ITEM: u64 = 1105;
    const E_WORKSHOP_REQUIRED: u64 = 1106;
    const E_WORKSHOP_NO_POWER: u64 = 1107;

    
    // ==================== CONSTANTS ====================
    
    // Blueprint uses by rarity
    const BLUEPRINT_COMMON_USES: u64 = 3;
    const BLUEPRINT_UNCOMMON_USES: u64 = 5;
    const BLUEPRINT_RARE_USES: u64 = 8;
    const BLUEPRINT_EPIC_USES: u64 = 12;
    const BLUEPRINT_LEGENDARY_USES: u64 = 20;
    const BLUEPRINT_MYTHIC_USES: u64 = 30;
    
    // Crafting costs (Scrap)
    const CRAFT_WEAPON_SCRAP: u64 = 50;
    const CRAFT_ARMOR_SCRAP: u64 = 60;
    const CRAFT_TOOL_SCRAP: u64 = 40;
    const CRAFT_FOOD_SCRAP: u64 = 20;
    const CRAFT_MEDICINE_SCRAP: u64 = 30;
    
    // ==================== STRUCTS ====================
    
    /// Blueprint for crafting items
    public struct Blueprint has key, store {
        id: UID,
        item_type: u8,       // What this blueprint crafts
        rarity: u8,          // Blueprint rarity (affects item quality)
        uses_remaining: u64, // Can be used multiple times
        max_uses: u64,       // Original uses (for display)
    }
    
    // ==================== FUNCTIONS ====================
    
    /// Create blueprint (called from expedition when dropped)
    public fun create_blueprint(
        item_type: u8,
        rarity: u8,
        ctx: &mut TxContext
    ): Blueprint {
        let max_uses = get_blueprint_uses_for_rarity(rarity);
        
        Blueprint {
            id: object::new(ctx),
            item_type,
            rarity,
            uses_remaining: max_uses,
            max_uses,
        }
    }
    
    /// Craft item from blueprint
    public entry fun craft_item(
        blueprint: &mut Blueprint,
        bunker: &mut Bunker,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(bunker::get_owner(bunker) == sender, E_NOT_OWNER);
        assert!(blueprint.uses_remaining > 0, E_BLUEPRINT_EXHAUSTED);

        // All crafting must happen in a powered Workshop.
        let workshop_opt = bunker::get_first_room_index_by_type(bunker, bunker::room_type_workshop());
        assert!(option::is_some(&workshop_opt), E_WORKSHOP_REQUIRED);
        assert!(bunker::is_power_sufficient(bunker), E_WORKSHOP_NO_POWER);
        
        // Get crafting cost
        let scrap_cost = get_crafting_cost(blueprint.item_type);
        
        // Check resources
        assert!(bunker::get_scrap(bunker) >= scrap_cost, E_INSUFFICIENT_SCRAP);
        
        // Consume scrap
        bunker::consume_scrap(bunker, scrap_cost);
        
        // Create item using blueprint's rarity
        let item = item::create_item_with_params(
            blueprint.item_type,
            blueprint.rarity,
            clock,
            ctx
        );
        
        // Reduce blueprint uses
        blueprint.uses_remaining = blueprint.uses_remaining - 1;
        
        // Get item ID before transfer
        let item_id = object::id(&item);
        
        // Transfer item to crafter
        transfer::public_transfer(item, sender);
        
        // Emit event
        utils::emit_item_crafted_event(
            item_id,
            sender,
            blueprint.item_type,
            scrap_cost,
            clock
        );
        
        // Emit exhausted event if needed
        if (blueprint.uses_remaining == 0) {
            utils::emit_blueprint_exhausted_event(
                object::id(blueprint),
                sender,
                clock
            );
        };
    }
    
    /// Destroy exhausted blueprint manually
    public entry fun destroy_blueprint(blueprint: Blueprint) {
        assert!(blueprint.uses_remaining == 0, E_BLUEPRINT_NOT_EXHAUSTED);
        
        let Blueprint { id, item_type: _, rarity: _, uses_remaining: _, max_uses: _ } = blueprint;
        object::delete(id);
    }

    /// Craft Bandage from a Cloth item (no scrap cost). Requires powered Workshop.
    public entry fun craft_bandage_from_cloth(
        cloth: item::Item,
        bunker: &mut Bunker,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        assert!(bunker::get_owner(bunker) == sender, E_NOT_OWNER);

        let workshop_opt = bunker::get_first_room_index_by_type(bunker, bunker::room_type_workshop());
        assert!(option::is_some(&workshop_opt), E_WORKSHOP_REQUIRED);
        assert!(bunker::is_power_sufficient(bunker), E_WORKSHOP_NO_POWER);

        assert!(item::get_item_type(&cloth) == item::type_cloth(), E_INVALID_ITEM);
        item::destroy_item(cloth);

        let bandage = item::create_bandage(ctx);
        let bandage_id = object::id(&bandage);
        transfer::public_transfer(bandage, sender);

        utils::emit_item_crafted_event(
            bandage_id,
            sender,
            item::type_bandage(),
            0,
            clock
        );
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /// Get blueprint info
    public fun get_blueprint_info(blueprint: &Blueprint): (u8, u8, u64, u64) {
        (blueprint.item_type, blueprint.rarity, blueprint.uses_remaining, blueprint.max_uses)
    }
    
    /// Get uses remaining
    public fun get_uses_remaining(blueprint: &Blueprint): u64 {
        blueprint.uses_remaining
    }
    
    /// Get item type
    public fun get_item_type(blueprint: &Blueprint): u8 {
        blueprint.item_type
    }
    
    /// Get rarity
    public fun get_rarity(blueprint: &Blueprint): u8 {
        blueprint.rarity
    }
    
    // ==================== HELPERS ====================
    
    /// Helper to determine uses by rarity
    fun get_blueprint_uses_for_rarity(rarity: u8): u64 {
        if (rarity == utils::rarity_common()) {
            BLUEPRINT_COMMON_USES
        } else if (rarity == utils::rarity_uncommon()) {
            BLUEPRINT_UNCOMMON_USES
        } else if (rarity == utils::rarity_rare()) {
            BLUEPRINT_RARE_USES
        } else if (rarity == utils::rarity_epic()) {
            BLUEPRINT_EPIC_USES
        } else if (rarity == utils::rarity_legendary()) {
            BLUEPRINT_LEGENDARY_USES
        } else {
            BLUEPRINT_MYTHIC_USES
        }
    }
    
    /// Helper to get scrap cost
    fun get_crafting_cost(item_type: u8): u64 {
        if (item_type == item::type_weapon()) {
            CRAFT_WEAPON_SCRAP
        } else if (item_type == item::type_armor()) {
            CRAFT_ARMOR_SCRAP
        } else if (item_type == item::type_tool()) {
            CRAFT_TOOL_SCRAP
        } else if (item_type == item::type_food()) {
            CRAFT_FOOD_SCRAP
        } else {
            CRAFT_MEDICINE_SCRAP
        }
    }
}
