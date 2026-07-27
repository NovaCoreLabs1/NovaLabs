// contracts/membership_token/tests/bench.rs
//
// Gas-benchmark harness for the membership_token contract (Issue #71).
//
// Each test runs a representative public method, captures the Soroban
// host budget delta, and emits a parseable `BENCH …` line on stderr.
// The Python script `scripts/bench_contracts.py` reads these lines and
// compares them against the checked-in baselines in
// `contracts/membership_token/benches/baseline.json`.

#![cfg(test)]

use membership_token::{MembershipTokenContract, MembershipTokenContractClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn emit_bench(method: &str, env: &Env, started_at: u64) {
    let estimate = env.cost_estimate();
    let cpu = estimate.cpu_insns.saturating_sub(started_at);
    let mem = estimate.mem_bytes;
    eprintln!("BENCH membership_token::{method} cpu={cpu} mem={mem}");
}

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
fn bench_set_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let start = env.cost_estimate().cpu_insns;
    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.set_admin(&admin);
    emit_bench("set_admin", &env, start);
}

#[test]
fn bench_set_minter() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _minter) = bootstrap(&env);
    let new_minter = Address::generate(&env);
    let start = env.cost_estimate().cpu_insns;
    client.set_minter(&new_minter);
    emit_bench("set_minter", &env, start);
}

#[test]
fn bench_issue_token() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _minter) = bootstrap(&env);
    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;
    let start = env.cost_estimate().cpu_insns;
    client.issue_token(&id, &user, &expiry);
    emit_bench("issue_token", &env, start);
}

#[test]
fn bench_transfer_token() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _minter) = bootstrap(&env);
    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let new_user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;
    client.issue_token(&id, &user, &expiry);
    let start = env.cost_estimate().cpu_insns;
    client.transfer_token(&id, &new_user);
    emit_bench("transfer_token", &env, start);
}

#[test]
fn bench_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _minter) = bootstrap(&env);
    let start = env.cost_estimate().cpu_insns;
    client.pause(&admin);
    emit_bench("pause", &env, start);
}
