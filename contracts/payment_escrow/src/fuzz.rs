// contracts/payment_escrow/src/fuzz.rs
//!
//! Proptest-based fuzz harness for the payment_escrow contract.
//!
//! Targets: escrow lifecycle transitions, dispute-window gating, claim timing,
//! double-operation rejection, and refund/release integrity.
//!
//! Run with:
//!   cargo test --release -p payment_escrow -- fuzz
//!
//! Reduced counterexamples are persisted by proptest in
//! `contracts/payment_escrow/proptest-regressions/` for CI regression runs.

extern crate std;

use super::*;
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

// ── Setup helpers ─────────────────────────────────────────────────────────────

fn setup_contract(env: &Env) -> Address {
    env.register(PaymentEscrowContract, ())
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
    dispute_window_secs: u64,
) -> PaymentEscrowContractClient<'a> {
    env.mock_all_auths();
    let client = PaymentEscrowContractClient::new(env, contract_id);
    client.initialize(admin, token, &dispute_window_secs);
    client
}

// ── Property tests ────────────────────────────────────────────────────────────

/// Strategy for escrow amounts: covers boundary (1), typical, and near-MAX values
/// without overflowing `amount * 3` in token setup.
fn escrow_amount() -> impl Strategy<Value = i128> {
    prop_oneof![
        Just(1i128),
        1i128..=1_000_000i128,
        Just(i128::MAX / 4), // safe: *4 won't overflow
    ]
}

proptest! {
    /// Invariant: created escrow has all fields stored correctly.
    #[test]
    fn prop_create_escrow_stores_correct_fields(
        amount in escrow_amount(),
        rel_after in prop_oneof![100u64..=86_400u64, Just(0u64)],
        dw in prop_oneof![100u64..=86_400u64, Just(0u64)],
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let token = setup_token(&env, &admin, &depositor, amount * 2);
        let client = init_client(&env, &contract_id, &admin, &token, dw);

        let escrow_id = String::from_str(&env, "esc-fuzz");
        let desc = String::from_str(&env, "Fuzz escrow");
        let now = env.ledger().timestamp();

        env.mock_all_auths();
        client.create_escrow(
            &depositor, &escrow_id, &beneficiary, &amount,
            &desc, &rel_after,
        );

        let escrow = client.get_escrow(&escrow_id);
        prop_assert_eq!(escrow.depositor, depositor);
        prop_assert_eq!(escrow.beneficiary, beneficiary);
        prop_assert_eq!(escrow.amount, amount);
        prop_assert_eq!(escrow.status, EscrowStatus::Pending);
        prop_assert_eq!(escrow.release_after, rel_after);
        prop_assert_eq!(escrow.dispute_window, dw);
        prop_assert!(escrow.created_at >= now);
    }

    /// Invariant: admin release transitions Pending → Released and sends funds.
    #[test]
    fn prop_admin_release_sends_funds(
        amount in escrow_amount(),
        dw in prop_oneof![100u64..=86_400u64, Just(0u64)],
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let initial_dep = amount * 2;
        let token = setup_token(&env, &admin, &depositor, initial_dep);
        let client = init_client(&env, &contract_id, &admin, &token, dw);

        let escrow_id = String::from_str(&env, "esc-fuzz");
        let desc = String::from_str(&env, "Fuzz escrow");

        env.mock_all_auths();
        client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

        let ben_balance_before = TokenClient::new(&env, &token).balance(&beneficiary);

        env.mock_all_auths();
        client.release(&admin, &escrow_id);

        let escrow = client.get_escrow(&escrow_id);
        prop_assert_eq!(escrow.status, EscrowStatus::Released);

        let ben_balance_after = TokenClient::new(&env, &token).balance(&beneficiary);
        prop_assert_eq!(ben_balance_after, ben_balance_before + amount,
            "beneficiary should receive exact amount");
    }

    /// Invariant: admin refund transitions Pending → Refunded and returns funds.
    #[test]
    fn prop_admin_refund_returns_funds(
        amount in 1i128..=1_000_000i128,
        dw in prop_oneof![100u64..=86_400u64, Just(0u64)],
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let initial_dep = amount * 2;
        let token = setup_token(&env, &admin, &depositor, initial_dep);
        let client = init_client(&env, &contract_id, &admin, &token, dw);

        let escrow_id = String::from_str(&env, "esc-fuzz");
        let desc = String::from_str(&env, "Fuzz escrow");

        env.mock_all_auths();
        client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

        env.mock_all_auths();
        client.refund(&admin, &escrow_id);

        let escrow = client.get_escrow(&escrow_id);
        prop_assert_eq!(escrow.status, EscrowStatus::Refunded);

        let dep_balance_after_refund = TokenClient::new(&env, &token).balance(&depositor);
        prop_assert_eq!(dep_balance_after_refund, initial_dep,
            "refund should restore depositor balance to initial amount");
    }

    /// Invariant: raise_dispute within window succeeds, changes status.
    #[test]
    fn prop_raise_dispute_within_window_succeeds(
        amount in escrow_amount(),
        window in 100u64..=86_400u64,
        offset in 0u64..=86_399u64,
    ) {
        // Only test cases where offset < window (within window)
        if offset >= window {
            return Ok(());
        }

        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let token = setup_token(&env, &admin, &depositor, amount * 2);
        let client = init_client(&env, &contract_id, &admin, &token, window);

        let escrow_id = String::from_str(&env, "esc-fuzz");
        let desc = String::from_str(&env, "Fuzz escrow");

        env.mock_all_auths();
        client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

        // Advance by offset
        env.ledger().with_mut(|l| l.timestamp += offset);

        env.mock_all_auths();
        client.raise_dispute(&depositor, &escrow_id);

        let escrow = client.get_escrow(&escrow_id);
        prop_assert_eq!(escrow.status, EscrowStatus::Disputed);
    }

    /// Invariant: resolve_dispute transitions to correct destination.
    #[test]
    fn prop_resolve_dispute_transitions(
        amount in escrow_amount(),
        release_to_beneficiary in proptest::bool::ANY,
        window in 100u64..=86_400u64,
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let initial = amount * 3;
        let token = setup_token(&env, &admin, &depositor, initial);
        let client = init_client(&env, &contract_id, &admin, &token, window);

        let escrow_id = String::from_str(&env, "esc-fuzz");
        let desc = String::from_str(&env, "Fuzz escrow");

        // Create
        env.mock_all_auths();
        client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

        // Dispute
        env.mock_all_auths();
        client.raise_dispute(&depositor, &escrow_id);

        let dep_before = TokenClient::new(&env, &token).balance(&depositor);
        let ben_before = TokenClient::new(&env, &token).balance(&beneficiary);

        // Resolve
        env.mock_all_auths();
        client.resolve_dispute(&admin, &escrow_id, &release_to_beneficiary);

        let escrow = client.get_escrow(&escrow_id);
        if release_to_beneficiary {
            prop_assert_eq!(escrow.status, EscrowStatus::Released);
            let ben_after = TokenClient::new(&env, &token).balance(&beneficiary);
            prop_assert_eq!(ben_after, ben_before + amount);
        } else {
            prop_assert_eq!(escrow.status, EscrowStatus::Refunded);
            let dep_after = TokenClient::new(&env, &token).balance(&depositor);
            prop_assert_eq!(dep_after, dep_before + amount);
        }
    }

    /// Invariant: claim succeeds after release_after and sends funds.
    #[test]
    fn prop_claim_after_release_succeeds(
        amount in escrow_amount(),
        rel_after in 100u64..=86_400u64,
        extra in 0u64..=86_400u64,
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let token = setup_token(&env, &admin, &depositor, amount * 2);
        let client = init_client(&env, &contract_id, &admin, &token, 0u64);

        let escrow_id = String::from_str(&env, "esc-fuzz");
        let desc = String::from_str(&env, "Fuzz escrow");

        let now = env.ledger().timestamp();
        env.mock_all_auths();
        client.create_escrow(
            &depositor, &escrow_id, &beneficiary, &amount, &desc,
            &(now + rel_after),
        );

        let ben_before = TokenClient::new(&env, &token).balance(&beneficiary);

        // Advance past release_after
        env.ledger().with_mut(|l| l.timestamp = now + rel_after + extra);

        env.mock_all_auths();
        client.claim(&beneficiary, &escrow_id);

        let escrow = client.get_escrow(&escrow_id);
        prop_assert_eq!(escrow.status, EscrowStatus::Released);
        let ben_after = TokenClient::new(&env, &token).balance(&beneficiary);
        prop_assert_eq!(ben_after, ben_before + amount,
            "beneficiary should receive exact amount on claim");
    }

    /// Invariant: set_dispute_window updates the global default.
    #[test]
    fn prop_set_dispute_window_updates_default(
        dw1 in prop_oneof![100u64..=86_400u64, Just(0u64)],
        dw2 in prop_oneof![100u64..=86_400u64, Just(0u64)],
    ) {
        let env = Env::default();
        let contract_id = setup_contract(&env);
        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let token = setup_token(&env, &admin, &depositor, 1_000i128);
        let client = init_client(&env, &contract_id, &admin, &token, dw1);

        prop_assert_eq!(client.dispute_window(), dw1);

        env.mock_all_auths();
        client.set_dispute_window(&admin, &dw2);

        prop_assert_eq!(client.dispute_window(), dw2);
    }
}

// ── Negative tests ────────────────────────────────────────────────────────────

/// Double-release must fail.
#[test]
#[should_panic]
fn test_double_release_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let amount: i128 = 1000;
    let token = setup_token(&env, &admin, &depositor, amount * 3);
    let client = init_client(&env, &contract_id, &admin, &token, 0u64);

    let escrow_id = String::from_str(&env, "esc-dbl");
    let desc = String::from_str(&env, "Double-release test");

    env.mock_all_auths();
    client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

    env.mock_all_auths();
    client.release(&admin, &escrow_id);

    // Second release → EscrowNotPending
    env.mock_all_auths();
    client.release(&admin, &escrow_id);
}

/// Dispute after window must fail.
#[test]
#[should_panic]
fn test_dispute_after_window_fails() {
    let env = Env::default();
    let window: u64 = 3600;
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let amount: i128 = 1000;
    let token = setup_token(&env, &admin, &depositor, amount * 2);
    let client = init_client(&env, &contract_id, &admin, &token, window);

    let escrow_id = String::from_str(&env, "esc-late");
    let desc = String::from_str(&env, "Late dispute test");

    env.mock_all_auths();
    client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

    // Advance past dispute window
    env.ledger().with_mut(|l| l.timestamp += window + 1);

    // Must panic (DisputeWindowClosed)
    env.mock_all_auths();
    client.raise_dispute(&depositor, &escrow_id);
}

/// Dispute with window=0 must fail.
#[test]
#[should_panic]
fn test_dispute_disabled_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let amount: i128 = 1000;
    let token = setup_token(&env, &admin, &depositor, amount * 2);
    let client = init_client(&env, &contract_id, &admin, &token, 0u64); // disabled

    let escrow_id = String::from_str(&env, "esc-nodisp");
    let desc = String::from_str(&env, "No dispute test");

    env.mock_all_auths();
    client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

    // Must panic (DisputeWindowClosed)
    env.mock_all_auths();
    client.raise_dispute(&depositor, &escrow_id);
}

/// Claim before release_after must fail.
#[test]
#[should_panic]
fn test_claim_before_release_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let amount: i128 = 1000;
    let token = setup_token(&env, &admin, &depositor, amount * 2);
    let client = init_client(&env, &contract_id, &admin, &token, 0u64);

    let now = env.ledger().timestamp();
    let release_after = now + 86_400; // 24h from now
    let escrow_id = String::from_str(&env, "esc-early");
    let desc = String::from_str(&env, "Early claim test");

    env.mock_all_auths();
    client.create_escrow(
        &depositor,
        &escrow_id,
        &beneficiary,
        &amount,
        &desc,
        &release_after,
    );

    // Must panic (ClaimTooEarly — haven't advanced time)
    env.mock_all_auths();
    client.claim(&beneficiary, &escrow_id);
}

/// Claim with release_after=0 must fail.
#[test]
#[should_panic]
fn test_claim_disabled_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let amount: i128 = 1000;
    let token = setup_token(&env, &admin, &depositor, amount * 2);
    let client = init_client(&env, &contract_id, &admin, &token, 0u64);

    let escrow_id = String::from_str(&env, "esc-noclaim");
    let desc = String::from_str(&env, "No auto-claim");

    env.mock_all_auths();
    client.create_escrow(&depositor, &escrow_id, &beneficiary, &amount, &desc, &0u64);

    // Must panic (AutoClaimDisabled)
    env.mock_all_auths();
    client.claim(&beneficiary, &escrow_id);
}

/// Zero/negative amount must fail.
#[test]
#[should_panic]
fn test_invalid_amount_rejected() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 1_000_000i128);
    let client = init_client(&env, &contract_id, &admin, &token, 0u64);

    let escrow_id = String::from_str(&env, "esc-zero");
    let desc = String::from_str(&env, "Zero amount");

    // Must panic (InvalidAmount)
    env.mock_all_auths();
    client.create_escrow(&depositor, &escrow_id, &beneficiary, &0i128, &desc, &0u64);
}
