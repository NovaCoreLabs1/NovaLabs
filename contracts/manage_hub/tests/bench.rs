// contracts/manage_hub/tests/bench.rs
//
// Gas-benchmark harness for the manage_hub contract (Issue #71).
//
// We intentionally exercise only the wrapper methods that don't require
// cross-contract setup with the underlying membership_token contract —
// `issue_token` on manage_hub delegates to the inner MembershipToken
// contract which requires both an admin AND a minter to be set on the
// inner contract, so a single-contract-register bench can't capture it
// cleanly. `set_admin` and `hello` are reliable entry points.

#![cfg(test)]

use manage_hub::{Contract, ContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn emit_bench(method: &str, env: &Env, started_at: u64) {
    let estimate = env.cost_estimate();
    let cpu = estimate.cpu_insns.saturating_sub(started_at);
    let mem = estimate.mem_bytes;
    eprintln!("BENCH manage_hub::{method} cpu={cpu} mem={mem}");
}

#[test]
fn bench_set_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let start = env.cost_estimate().cpu_insns;
    client.set_admin(&admin);
    emit_bench("set_admin", &env, start);
}

#[test]
fn bench_hello() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let start = env.cost_estimate().cpu_insns;
    let _ = client.hello(&soroban_sdk::String::from_str(&env, "Bench"));
    emit_bench("hello", &env, start);
}
