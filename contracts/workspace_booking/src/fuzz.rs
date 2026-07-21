// contracts/workspace_booking/src/fuzz.rs
//!
//! Proptest-based fuzz harness for the workspace_booking contract.
//!
//! Targets: booking cost invariant, slot-overlap detection, cancel-refund
//! integrity, lifecycle state transitions, and availability gating.
//!
//! Run with:
//!   cargo test --release -p workspace_booking -- fuzz
//!
//! Reduced counterexamples are persisted by proptest in
//! `contracts/workspace_booking/proptest-regressions/` for CI regression runs.

extern crate std;

use super::*;
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup_contract(env: &Env) -> Address {
    env.register(WorkspaceBookingContract, ())
}

fn setup_token(env: &Env, admin: &Address, recipient: &Address, amount: i128) -> Address {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(env, &token_address)
        .mock_all_auths()
        .mint(recipient, &amount);
    token_address
}

fn init_client<'a>(
    env: &'a Env,
    contract_id: &Address,
    admin: &Address,
    token: &Address,
) -> WorkspaceBookingContractClient<'a> {
    env.mock_all_auths();
    let client = WorkspaceBookingContractClient::new(env, contract_id);
    client.initialize(admin, token);
    client
}

// ── Property tests: invariants that must always hold ──────────────────────────

/// Strategy for booking rates: covers boundary (1), typical, and near-MAX values
/// without overflowing `rate * max_hours` in token setup.
fn booking_rate() -> impl Strategy<Value = u128> {
    prop_oneof![
        Just(1u128),
        1u128..=1_000_000u128,
        Just(500_000_000_000u128), // large but safe: *24 = 12T, fits i128
    ]
}

/// Strategy for durations: covers boundary (1 sec), typical, and max (24h).
fn booking_duration() -> impl Strategy<Value = u64> {
    prop_oneof![
        Just(1u64),
        600u64..=86_400u64,
        Just(86_400u64), // exactly 24h
    ]
}

proptest! {
    /// Invariant: booking cost = hourly_rate × ceil(duration_secs / 3600)
    #[test]
    fn prop_booking_cost_calculation(
        rate in booking_rate(),
        dur_secs in booking_duration(),
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let member = Address::generate(&env);
        // Ensure enough balance: worst case dur_secs=86400 → ceil(86400/3600)=24 hours
        let max_hours = (dur_secs as u128).div_ceil(3600);
        let needed: i128 = (rate * max_hours) as i128;
        let token = setup_token(&env, &admin, &member, needed + 1000);
        let client = init_client(&env, &contract_id, &admin, &token);

        let ws_id = String::from_str(&env, "ws-fuzz");
        env.mock_all_auths();
        client.register_workspace(
            &admin, &ws_id, &String::from_str(&env, "Fuzz WS"),
            &WorkspaceType::HotDesk, &1u32, &rate,
        );

        let start = env.ledger().timestamp() + 60;
        let end = start + dur_secs;

        env.mock_all_auths();
        client.book_workspace(
            &member,
            &String::from_str(&env, "bk-001"),
            &ws_id, &start, &end,
        );

        let booking = client.get_booking(&String::from_str(&env, "bk-001"));
        let dur_u128 = dur_secs as u128;
        let expected_hours = dur_u128.div_ceil(3600); // ceil(duration/3600)
        let expected_cost = rate * expected_hours;
        prop_assert_eq!(booking.amount_paid, expected_cost,
            "amount_paid={} but expected rate={} * ceil({}/3600) = {}",
            booking.amount_paid, rate, dur_secs, expected_cost);
    }

    /// Invariant: non-overlapping bookings both succeed.
    #[test]
    fn prop_non_overlapping_bookings_succeed(
        dur_a in 600u64..=3_600u64,
        dur_b in 600u64..=3_600u64,
        gap in 0u64..=86_400u64,
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let member = Address::generate(&env);
        let token = setup_token(&env, &admin, &member, 1_000_000i128);
        let client = init_client(&env, &contract_id, &admin, &token);

        let ws_id = String::from_str(&env, "ws-fuzz");
        env.mock_all_auths();
        client.register_workspace(
            &admin, &ws_id, &String::from_str(&env, "WS"),
            &WorkspaceType::HotDesk, &1u32, &1u128,
        );

        let now = env.ledger().timestamp();
        let a_start = now + 60;
        let a_end = a_start + dur_a;
        let b_start = a_end + gap; // non-overlapping
        let b_end = b_start + dur_b;

        env.mock_all_auths();
        client.book_workspace(&member, &String::from_str(&env, "bk-a"), &ws_id, &a_start, &a_end);

        env.mock_all_auths();
        client.book_workspace(&member, &String::from_str(&env, "bk-b"), &ws_id, &b_start, &b_end);

        let bka = client.get_booking(&String::from_str(&env, "bk-a"));
        let bkb = client.get_booking(&String::from_str(&env, "bk-b"));
        prop_assert_eq!(bka.status, BookingStatus::Active);
        prop_assert_eq!(bkb.status, BookingStatus::Active);
    }

    /// Invariant: cancel always refunds the exact amount paid.
    #[test]
    fn prop_cancel_refunds_exact_amount(
        rate in booking_rate(),
        dur_secs in booking_duration(),
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let member = Address::generate(&env);
        let max_hours = (dur_secs as u128).div_ceil(3600);
        let needed: i128 = (rate * max_hours) as i128;
        let token = setup_token(&env, &admin, &member, needed + 1000);
        let client = init_client(&env, &contract_id, &admin, &token);

        let ws_id = String::from_str(&env, "ws-fuzz");
        env.mock_all_auths();
        client.register_workspace(
            &admin, &ws_id, &String::from_str(&env, "WS"),
            &WorkspaceType::HotDesk, &1u32, &rate,
        );

        let start = env.ledger().timestamp() + 60;
        let end = start + dur_secs;

        env.mock_all_auths();
        client.book_workspace(&member, &String::from_str(&env, "bk-001"), &ws_id, &start, &end);

        env.mock_all_auths();
        client.cancel_booking(&member, &String::from_str(&env, "bk-001"));
        let balance_after_cancel = TokenClient::new(&env, &token).balance(&member);

        prop_assert_eq!(balance_after_cancel, needed + 1000,
            "cancel should refund full amount: initial={} after_cancel={}",
            needed + 1000, balance_after_cancel);

        let booking = client.get_booking(&String::from_str(&env, "bk-001"));
        prop_assert_eq!(booking.status, BookingStatus::Cancelled);
    }

    /// Invariant: complete_booking transitions Active → Completed.
    #[test]
    fn prop_complete_booking_transitions_correctly(
        dur_secs in 600u64..=7_200u64,
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let member = Address::generate(&env);
        let token = setup_token(&env, &admin, &member, 1_000_000i128);
        let client = init_client(&env, &contract_id, &admin, &token);

        let ws_id = String::from_str(&env, "ws-fuzz");
        env.mock_all_auths();
        client.register_workspace(
            &admin, &ws_id, &String::from_str(&env, "WS"),
            &WorkspaceType::HotDesk, &1u32, &1u128,
        );

        let start = env.ledger().timestamp() + 60;
        let end = start + dur_secs;

        env.mock_all_auths();
        client.book_workspace(&member, &String::from_str(&env, "bk-001"), &ws_id, &start, &end);

        // Advance time past the booking end
        env.ledger().with_mut(|l| l.timestamp = end + 1);

        env.mock_all_auths();
        client.complete_booking(&admin, &String::from_str(&env, "bk-001"));

        let booking = client.get_booking(&String::from_str(&env, "bk-001"));
        prop_assert_eq!(booking.status, BookingStatus::Completed);
        prop_assert!(booking.completed_at.is_some());
    }

    /// Invariant: after setting a new rate, new bookings use the new rate.
    #[test]
    fn prop_rate_update_applies_to_future_bookings(
        old_rate in booking_rate(),
        new_rate in booking_rate(),
        dur_secs in booking_duration(),
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let member = Address::generate(&env);
        // Compute sufficient balance for both bookings (old + new rate)
        let max_hours = (dur_secs as u128).div_ceil(3600);
        let cost_old: i128 = (old_rate * max_hours) as i128;
        let cost_new: i128 = (new_rate * max_hours) as i128;
        let total_needed: i128 = cost_old.saturating_add(cost_new);
        let token = setup_token(&env, &admin, &member, total_needed);
        let client = init_client(&env, &contract_id, &admin, &token);

        let ws_id = String::from_str(&env, "ws-fuzz");
        env.mock_all_auths();
        client.register_workspace(
            &admin, &ws_id, &String::from_str(&env, "WS"),
            &WorkspaceType::HotDesk, &1u32, &old_rate,
        );

        // Book at old rate
        let t0 = env.ledger().timestamp();
        let a_start = t0 + 60;
        let a_end = a_start + dur_secs;
        env.mock_all_auths();
        client.book_workspace(&member, &String::from_str(&env, "bk-a"), &ws_id, &a_start, &a_end);
        let booking_a = client.get_booking(&String::from_str(&env, "bk-a"));
        let dur_u128 = dur_secs as u128;
        let expected_old_cost = old_rate * dur_u128.div_ceil(3600);
        prop_assert_eq!(booking_a.amount_paid, expected_old_cost);

        // Change rate
        env.mock_all_auths();
        client.set_workspace_rate(&admin, &ws_id, &new_rate);

        // Book at new rate (non-overlapping slot)
        let b_start = a_end + 60;
        let b_end = b_start + dur_secs;
        env.mock_all_auths();
        client.book_workspace(&member, &String::from_str(&env, "bk-b"), &ws_id, &b_start, &b_end);
        let booking_b = client.get_booking(&String::from_str(&env, "bk-b"));
        let expected_new_cost = new_rate * dur_u128.div_ceil(3600);
        prop_assert_eq!(booking_b.amount_paid, expected_new_cost);
    }

    /// Invariant: check_availability accurately reflects booking state.
    #[test]
    fn prop_availability_reflects_booking_state(
        dur in 600u64..=3_600u64,
        gap in 60u64..=86_400u64,
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let member = Address::generate(&env);
        let token = setup_token(&env, &admin, &member, 1_000_000i128);
        let client = init_client(&env, &contract_id, &admin, &token);

        let ws_id = String::from_str(&env, "ws-fuzz");
        env.mock_all_auths();
        client.register_workspace(
            &admin, &ws_id, &String::from_str(&env, "WS"),
            &WorkspaceType::HotDesk, &1u32, &1u128,
        );

        let now = env.ledger().timestamp();
        let a_start = now + 60;
        let a_end = a_start + dur;

        env.mock_all_auths();
        client.book_workspace(&member, &String::from_str(&env, "bk-a"), &ws_id, &a_start, &a_end);

        // Exact same slot is unavailable
        prop_assert!(!client.check_availability(&ws_id, &a_start, &a_end));

        // Slot immediately after (no overlap) is available
        let after_start = a_end + gap;
        let after_end = after_start + dur;
        prop_assert!(client.check_availability(&ws_id, &after_start, &after_end));
    }
}

// ── Negative tests: operations that must always fail ──────────────────────────

/// Overlapping bookings on the same workspace must always fail.
#[test]
#[should_panic]
fn test_overlapping_booking_fails_deterministic() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let token = setup_token(&env, &admin, &member, 1_000_000i128);
    let client = init_client(&env, &contract_id, &admin, &token);

    let ws_id = String::from_str(&env, "ws-overlap");
    env.mock_all_auths();
    client.register_workspace(
        &admin,
        &ws_id,
        &String::from_str(&env, "WS"),
        &WorkspaceType::HotDesk,
        &1u32,
        &500u128,
    );

    let now = env.ledger().timestamp();
    let start = now + 60;
    let end = start + 3600;

    env.mock_all_auths();
    client.book_workspace(
        &member,
        &String::from_str(&env, "bk-a"),
        &ws_id,
        &start,
        &end,
    );

    // Overlap: starts in the middle of first booking
    env.mock_all_auths();
    client.book_workspace(
        &member,
        &String::from_str(&env, "bk-b"),
        &ws_id,
        &(start + 1800),
        &(end + 1800),
    );
}

/// Unavailable workspace must reject new bookings.
#[test]
#[should_panic]
fn test_unavailable_workspace_rejects_bookings() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let token = setup_token(&env, &admin, &member, 1_000_000i128);
    let client = init_client(&env, &contract_id, &admin, &token);

    let ws_id = String::from_str(&env, "ws-unavail");
    env.mock_all_auths();
    client.register_workspace(
        &admin,
        &ws_id,
        &String::from_str(&env, "WS"),
        &WorkspaceType::HotDesk,
        &1u32,
        &500u128,
    );

    // Mark unavailable
    env.mock_all_auths();
    client.set_workspace_availability(&admin, &ws_id, &false);

    let start = env.ledger().timestamp() + 60;
    let end = start + 3600;

    // Must panic (WorkspaceUnavailable)
    env.mock_all_auths();
    client.book_workspace(
        &member,
        &String::from_str(&env, "bk-001"),
        &ws_id,
        &start,
        &end,
    );
}

/// Invalid time range (start >= end) must be rejected.
#[test]
#[should_panic]
fn test_invalid_time_range_rejected() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let token = setup_token(&env, &admin, &member, 10_000i128);
    let client = init_client(&env, &contract_id, &admin, &token);

    let ws_id = String::from_str(&env, "ws-time");
    env.mock_all_auths();
    client.register_workspace(
        &admin,
        &ws_id,
        &String::from_str(&env, "WS"),
        &WorkspaceType::HotDesk,
        &1u32,
        &1u128,
    );

    // start >= end (invalid)
    env.mock_all_auths();
    client.book_workspace(
        &member,
        &String::from_str(&env, "bk-001"),
        &ws_id,
        &3600u64,
        &60u64,
    );
}

/// Zero capacity must be rejected.
#[test]
#[should_panic]
fn test_zero_capacity_rejected() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let client = init_client(&env, &contract_id, &admin, &token);

    let ws_id = String::from_str(&env, "ws-zero");
    env.mock_all_auths();
    client.register_workspace(
        &admin,
        &ws_id,
        &String::from_str(&env, "Bad"),
        &WorkspaceType::HotDesk,
        &0u32,
        &100u128,
    );
}

/// Zero hourly rate must be rejected.
#[test]
#[should_panic]
fn test_zero_rate_rejected() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let client = init_client(&env, &contract_id, &admin, &token);

    let ws_id = String::from_str(&env, "ws-zerorate");
    env.mock_all_auths();
    client.register_workspace(
        &admin,
        &ws_id,
        &String::from_str(&env, "Bad"),
        &WorkspaceType::HotDesk,
        &1u32,
        &0u128,
    );
}
