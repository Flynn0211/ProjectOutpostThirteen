#[test_only]
module contracts::contracts_tests {
    use sui::clock;
    use sui::tx_context;

    use contracts::bunker;
    use contracts::item;
    use contracts::npc;

    #[test]
    fun test_capacity_derived_from_living_rooms() {
        let owner = @0x42;
        let mut ctx = tx_context::new(owner, tx_context::dummy_tx_hash_with_hint(1), 0, 0, 0);

        let mut bunker = bunker::new_bunker_for_testing(owner, &mut ctx);
        assert!(bunker::get_capacity(&bunker) == 10, 0);

        bunker::add_scrap(&mut bunker, 1000);
        bunker::add_room(&mut bunker, bunker::room_type_living(), &mut ctx);
        assert!(bunker::get_capacity(&bunker) == 20, 1);

        bunker::upgrade_room(&mut bunker, 0, &mut ctx);
        assert!(bunker::get_capacity(&bunker) == 22, 2);

        bunker::destroy_bunker_for_testing(bunker);
    }

    #[test]
    fun test_production_remainder_prevents_loss_on_frequent_collects() {
        let owner = @0x42;
        let mut ctx = tx_context::new(owner, tx_context::dummy_tx_hash_with_hint(2), 0, 0, 0);

        let mut clock_obj = clock::create_for_testing(&mut ctx);
        clock::set_for_testing(&mut clock_obj, 1);

        let mut bunker = bunker::new_bunker_for_testing(owner, &mut ctx);
        // Farm is room index 2 in the initial bunker.
        bunker::increment_room_workers(&mut bunker, 2, &clock_obj);
        bunker::increment_room_workers(&mut bunker, 2, &clock_obj);

        let initial_food = bunker::get_food(&bunker);

        // Collect every 10-minute tick for 12 ticks.
        // Expected: floor(rate(10) * workers(2) * ticks(12) * eff(50) / (100 * 6))
        //          = floor(12000 / 600) = 20
        let tick_ms = 600000;
        let mut i = 0;
        while (i < 12) {
            let now = 1 + ((i + 1) * tick_ms);
            clock::set_for_testing(&mut clock_obj, now);
            bunker::collect_production(&mut bunker, 2, &clock_obj, &mut ctx);
            i = i + 1;
        };

        let final_food = bunker::get_food(&bunker);
        assert!(final_food - initial_food == 20, 10);

        clock::destroy_for_testing(clock_obj);
        bunker::destroy_bunker_for_testing(bunker);
    }

    #[test, expected_failure(abort_code = 215, location = contracts::npc)]
    fun test_revive_requires_knocked() {
        let owner = @0x42;
        let mut ctx = tx_context::new(owner, tx_context::dummy_tx_hash_with_hint(3), 0, 0, 0);

        let mut clock_obj = clock::create_for_testing(&mut ctx);
        clock::set_for_testing(&mut clock_obj, 1);

        let mut npc_obj = npc::new_npc_for_testing(owner, &mut ctx);
        let potion = item::create_item_with_params(item::type_revival_potion(), 1, &clock_obj, &mut ctx);

        // Should abort because NPC is not knocked.
        npc::revive_npc(&mut npc_obj, potion, &clock_obj, &mut ctx);

        // Satisfy the verifier on the non-abort path.
        npc::destroy_npc_for_testing(npc_obj);
        clock::destroy_for_testing(clock_obj);
    }

    #[test]
    fun test_revive_succeeds_when_knocked() {
        let owner = @0x42;
        let mut ctx = tx_context::new(owner, tx_context::dummy_tx_hash_with_hint(4), 0, 0, 0);

        let mut clock_obj = clock::create_for_testing(&mut ctx);
        clock::set_for_testing(&mut clock_obj, 123);

        let mut npc_obj = npc::new_npc_for_testing(owner, &mut ctx);
        npc::knock_out(&mut npc_obj, b"test", &clock_obj);
        assert!(npc::is_knocked(&npc_obj), 20);

        let potion = item::create_item_with_params(item::type_revival_potion(), 1, &clock_obj, &mut ctx);
        npc::revive_npc(&mut npc_obj, potion, &clock_obj, &mut ctx);

        assert!(!npc::is_knocked(&npc_obj), 21);
        assert!(npc::get_current_hp(&npc_obj) > 0, 22);

        npc::destroy_npc_for_testing(npc_obj);
        clock::destroy_for_testing(clock_obj);
    }

    #[test, expected_failure(abort_code = 208, location = contracts::npc)]
    fun test_consume_water_item_requires_water_type() {
        let owner = @0x42;
        let mut ctx = tx_context::new(owner, tx_context::dummy_tx_hash_with_hint(5), 0, 0, 0);

        let mut clock_obj = clock::create_for_testing(&mut ctx);
        clock::set_for_testing(&mut clock_obj, 1);

        let mut npc_obj = npc::new_npc_for_testing(owner, &mut ctx);
        let wrong_item = item::create_item_with_params(item::type_food(), 1, &clock_obj, &mut ctx);

        // Should abort because item is not Water.
        npc::consume_water_item(&mut npc_obj, wrong_item, &clock_obj);

        // Satisfy the verifier on the non-abort path.
        npc::destroy_npc_for_testing(npc_obj);
        clock::destroy_for_testing(clock_obj);
    }

    #[test]
    fun test_consume_water_item_restores_thirst() {
        let owner = @0x42;
        let mut ctx = tx_context::new(owner, tx_context::dummy_tx_hash_with_hint(6), 0, 0, 0);

        let mut clock_obj = clock::create_for_testing(&mut ctx);
        clock::set_for_testing(&mut clock_obj, 1);

        let mut npc_obj = npc::new_npc_for_testing(owner, &mut ctx);
        // Reduce thirst to 10.
        npc::decrease_needs(&mut npc_obj, 0, 90);
        assert!(npc::get_thirst(&npc_obj) == 10, 30);

        let water_item = item::create_item_with_params(item::type_water(), 1, &clock_obj, &mut ctx);
        npc::consume_water_item(&mut npc_obj, water_item, &clock_obj);
        assert!(npc::get_thirst(&npc_obj) == 70, 31);

        npc::destroy_npc_for_testing(npc_obj);
        clock::destroy_for_testing(clock_obj);
    }
}
