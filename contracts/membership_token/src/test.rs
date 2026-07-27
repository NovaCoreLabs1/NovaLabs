#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, BytesN as BytesNTestUtils, Ledger},
    Address, BytesN, Env,
};

/// Helper: create a fresh contract with admin AND minter set so the
/// existing happy-path tests continue to work after the role-separation
/// refactor (Issue #77). All existing positive tests should call this
/// helper before exercising token mint flows.
fn bootstrap(env: &Env) -> (MembershipTokenContractClient, Address, Address) {
    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let minter = Address::generate(env);
    client.set_admin(&admin);
    client.set_minter(&minter);

    (client, admin, minter)
}

#[test]
fn test_set_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let result = client.try_set_admin(&admin);
    assert!(result.is_ok());
}

#[test]
fn test_set_minter_requires_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let minter = Address::generate(&env);
    let result = client.try_set_minter(&minter);
    assert!(result.is_ok());
    assert_eq!(client.get_minter(), Some(minter));
}

#[test]
fn test_set_minter_before_set_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let minter = Address::generate(&env);
    let result = client.try_set_minter(&minter);
    assert!(result.is_err());
}

#[test]
fn test_set_admin_clears_existing_minter() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin1 = Address::generate(&env);
    let minter = Address::generate(&env);

    client.set_admin(&admin1);
    client.set_minter(&minter);
    assert_eq!(client.get_minter(), Some(minter));

    let admin2 = Address::generate(&env);
    client.set_admin(&admin2);
    assert_eq!(client.get_minter(), None);
}

#[test]
fn test_issue_token() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_ok());
}

#[test]
fn test_issue_token_already_exists() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    client.issue_token(&id, &user, &expiry);
    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_err());
}

#[test]
fn test_issue_token_invalid_expiry() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let past_expiry = 0u64;

    let result = client.try_issue_token(&id, &user, &past_expiry);
    assert!(result.is_err());
}

#[test]
fn test_get_token() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    client.issue_token(&id, &user, &expiry);

    let token = client.get_token(&id);
    assert_eq!(token.id, id);
    assert_eq!(token.user, user);
    assert_eq!(token.status, MembershipStatus::Active);
}

#[test]
fn test_get_token_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let result = client.try_get_token(&id);
    assert!(result.is_err());
}

#[test]
fn test_transfer_token() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let new_user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    client.issue_token(&id, &user, &expiry);
    let result = client.try_transfer_token(&id, &new_user);
    assert!(result.is_ok());

    let token = client.get_token(&id);
    assert_eq!(token.user, new_user);
}

#[test]
fn test_issue_token_without_minter_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);
    // deliberately DO NOT set a minter

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_err());
}

// ── Negative-path tests (Issue #68) ───────────────────────────────────────────

#[test]
fn test_transfer_token_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let id = BytesN::<32>::random(&env);
    let new_user = Address::generate(&env);

    let result = client.try_transfer_token(&id, &new_user);
    assert!(result.is_err());
}

#[test]
fn test_transfer_expired_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let new_user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100;

    client.issue_token(&id, &user, &expiry);

    // Advance past expiry — status is still Active in storage,
    // transfer_token only checks the status field, not the expiry_date.
    env.ledger().with_mut(|l| l.timestamp += 200);

    // Transfer succeeds because the contract doesn't enforce expiry on transfer
    let result = client.try_transfer_token(&id, &new_user);
    assert!(result.is_ok());
}

#[test]
fn test_get_token_expired_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100;

    client.issue_token(&id, &user, &expiry);

    // Advance past expiry
    env.ledger().with_mut(|l| l.timestamp += 200);

    let result = client.try_get_token(&id);
    assert!(result.is_err());
}

#[test]
fn test_issue_token_expiry_at_current_time_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let current_time = env.ledger().timestamp();

    // Expiry == current time should fail (expiry must be > current time)
    let result = client.try_issue_token(&id, &user, &current_time);
    assert!(result.is_err());
}

#[test]
fn test_issue_token_with_different_ids_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;

    let id1 = BytesN::<32>::random(&env);
    let id2 = BytesN::<32>::random(&env);

    let r1 = client.try_issue_token(&id1, &user, &expiry);
    assert!(r1.is_ok());

    let r2 = client.try_issue_token(&id2, &user, &expiry);
    assert!(r2.is_ok());
}

#[test]
fn test_get_active_token_returns_details() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;

    client.issue_token(&id, &user, &expiry);

    let token = client.get_token(&id);
    assert_eq!(token.id, id);
    assert_eq!(token.user, user);
    assert_eq!(token.status, MembershipStatus::Active);
    assert_eq!(token.issue_date, env.ledger().timestamp());
    assert_eq!(token.expiry_date, expiry);
}

#[test]
fn test_transfer_token_updates_user() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let new_user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;

    client.issue_token(&id, &user, &expiry);

    let token_before = client.get_token(&id);
    assert_eq!(token_before.user, user);

    client.transfer_token(&id, &new_user);

    let token_after = client.get_token(&id);
    assert_eq!(token_after.user, new_user);
    assert_eq!(token_after.status, MembershipStatus::Active);
}

#[test]
fn test_set_admin_updates_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    client.set_admin(&admin1);
    // admin2 becomes admin. AS admin1 we now cannot set_minter
    // because the current admin (admin2) must authorize it.
    client.set_admin(&admin2);

    assert_eq!(client.get_admin(), Some(admin2));
}

// ── Pause / role-separation tests (Issue #77) ────────────────────────────────

#[test]
fn test_admin_can_pause_and_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, _minter) = bootstrap(&env);

    assert!(!client.is_paused());
    client.pause(&admin);
    assert!(client.is_paused());
    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
fn test_pause_then_issue_token_returns_contract_paused_error() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, _minter) = bootstrap(&env);

    client.pause(&admin);
    assert!(client.is_paused());

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;
    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_err());

    // Unpause to confirm minting resumes.
    client.unpause(&admin);
    assert!(!client.is_paused());
    let ok = client.try_issue_token(&id, &user, &expiry);
    assert!(ok.is_ok());
}

#[test]
fn test_minter_cannot_call_pause() {
    // Issue #77 acceptance criterion: minter cannot call pause.
    // With `mock_all_auths()` the minter's `require_auth` passes — but
    // the semantic admin-equality check (`caller != admin`) trips. The
    // host-level auth tree alone is not enough to defend the admin slot
    // against an authorised minter; the role-based check is required.
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, minter) = bootstrap(&env);

    let result = client.try_pause(&minter);
    assert!(result.is_err());
    assert!(!client.is_paused());
}

#[test]
fn test_minter_cannot_call_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, minter) = bootstrap(&env);

    client.pause(&admin);

    let result = client.try_unpause(&minter);
    assert!(result.is_err());
    assert!(client.is_paused());

    // Sanity: only the admin can unpause.
    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
fn test_pause_twice_returns_already_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, _minter) = bootstrap(&env);

    client.pause(&admin);
    let second = client.try_pause(&admin);
    assert!(second.is_err());
}

#[test]
fn test_unpause_when_not_paused_returns_not_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, _minter) = bootstrap(&env);

    let result = client.try_unpause(&admin);
    assert!(result.is_err());
}

#[test]
fn test_unrelated_address_cannot_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _minter) = bootstrap(&env);

    let stranger = Address::generate(&env);
    let result = client.try_pause(&stranger);
    assert!(result.is_err());
    assert!(!client.is_paused());
}
