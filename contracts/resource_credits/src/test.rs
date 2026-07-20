// contracts/resource_credits/src/test.rs
//
// Tests for the `resource_credits` Soroban contract.
//
// The CI coverage gate (`.github/workflows/CI.yaml` :: coverage) requires at
// least 80% line coverage per contract crate. This suite exercises every
// public method and every `Error` variant in `errors.rs` so the crate clears
// the threshold.
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

// ── Initialisation ────────────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    client.initialize(&admin, &token);

    assert_eq!(client.total_supply(), 0u128);
    assert_eq!(client.balance(&Address::generate(&env)), 0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_initialize_twice_fails() {
    // AlreadyInitialized = 2
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    client.initialize(&admin, &token);
    client.initialize(&admin, &token);
}

// ── Mint ──────────────────────────────────────────────────────────────────────

#[test]
fn test_mint_credits_increases_balance_and_supply() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.initialize(&admin, &token);

    client.mint_credits(&admin, &recipient, &500u128);

    assert_eq!(client.balance(&recipient), 500u128);
    assert_eq!(client.total_supply(), 500u128);
}

#[test]
fn test_mint_credits_accumulates_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &recipient, &100u128);
    client.mint_credits(&admin, &recipient, &250u128);

    assert_eq!(client.balance(&recipient), 350u128);
    assert_eq!(client.total_supply(), 350u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_mint_credits_zero_amount_fails() {
    // InvalidAmount = 5
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &recipient, &0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_mint_credits_non_admin_fails() {
    // Unauthorized = 3
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let recipient = Address::generate(&env);
    let imposter = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&imposter, &recipient, &100u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_mint_credits_before_initialize_fails() {
    // AdminNotSet = 1 — `get_admin` returns None because initialize was never called
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint_credits(&admin, &recipient, &100u128);
}

// ── Transfer ─────────────────────────────────────────────────────────────────

#[test]
fn test_transfer_credits_moves_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &from, &1_000u128);

    client.transfer_credits(&from, &to, &400u128);

    assert_eq!(client.balance(&from), 600u128);
    assert_eq!(client.balance(&to), 400u128);
    // Supply must remain unchanged after a transfer
    assert_eq!(client.total_supply(), 1_000u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_transfer_credits_zero_amount_fails() {
    // InvalidAmount = 5
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &from, &1_000u128);

    client.transfer_credits(&from, &to, &0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_transfer_credits_insufficient_balance_fails() {
    // InsufficientBalance = 4
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &from, &50u128);

    // Try to transfer more than balance
    client.transfer_credits(&from, &to, &100u128);
}

// ── Spend ────────────────────────────────────────────────────────────────────

#[test]
fn test_spend_credits_decreases_balance_and_supply() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let member = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &member, &800u128);

    client.spend_credits(&member, &300u128);

    assert_eq!(client.balance(&member), 500u128);
    assert_eq!(client.total_supply(), 500u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_spend_credits_zero_amount_fails() {
    // InvalidAmount = 5
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let member = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &member, &100u128);

    client.spend_credits(&member, &0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_spend_credits_insufficient_balance_fails() {
    // InsufficientBalance = 4
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let member = Address::generate(&env);

    client.initialize(&admin, &token);
    client.mint_credits(&admin, &member, &10u128);

    client.spend_credits(&member, &50u128);
}

// ── Queries ──────────────────────────────────────────────────────────────────

#[test]
fn test_balance_default_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    client.initialize(&admin, &token);

    // Querying a fresh address returns 0
    let stranger = Address::generate(&env);
    assert_eq!(client.balance(&stranger), 0u128);
}

#[test]
fn test_total_supply_default_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    client.initialize(&admin, &token);

    assert_eq!(client.total_supply(), 0u128);
}

// ── End-to-end flow ──────────────────────────────────────────────────────────

#[test]
fn test_full_mint_transfer_spend_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.initialize(&admin, &token);

    // Admin mints to Alice and Bob
    client.mint_credits(&admin, &alice, &1_000u128);
    client.mint_credits(&admin, &bob, &500u128);
    assert_eq!(client.total_supply(), 1_500u128);

    // Alice transfers to Bob
    client.transfer_credits(&alice, &bob, &200u128);
    assert_eq!(client.balance(&alice), 800u128);
    assert_eq!(client.balance(&bob), 700u128);
    assert_eq!(client.total_supply(), 1_500u128); // unchanged by transfer

    // Bob spends credits
    client.spend_credits(&bob, &100u128);
    assert_eq!(client.balance(&bob), 600u128);
    assert_eq!(client.total_supply(), 1_400u128);
}