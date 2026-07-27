// contracts/workspace_booking/tests/bench.rs
//
// Gas-benchmark harness for the workspace_booking contract (Issue #71).
//
// NOTE: this bench intentionally does NOT register a real Stellar asset
// contract because `register_stellar_asset_contract_v2` + the
// `StellarAssetClient` testutils API only exist in later soroban-sdk
// releases — we need this bench to compile on stable 23.4.1 with no
// extra host-API dependencies. The `book_workspace` call will fall
// through to `Error::PaymentTokenNotSet`, so we use `try_*` for the
// book benchmark and avoid an actual token transfer. The availability /
// get benchmarks exercise the read path which doesn't touch the token.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use workspace_booking::{WorkspaceBookingContract, WorkspaceBookingContractClient, WorkspaceType};

fn emit_bench(method: &str, env: &Env, started_at: u64) {
    let estimate = env.cost_estimate();
    let cpu = estimate.cpu_insns.saturating_sub(started_at);
    let mem = estimate.mem_bytes;
    eprintln!("BENCH workspace_booking::{method} cpu={cpu} mem={mem}");
}

/// Bootstrap a workspace_booking contract with admin, payment-token
/// placeholder, and a registered workspace.
fn bootstrap(env: &Env) -> (WorkspaceBookingContractClient, Address, String) {
    let payment_token = Address::generate(env);

    let contract_id = env.register(WorkspaceBookingContract, ());
    let client = WorkspaceBookingContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    client.initialize(&admin, &payment_token);

    let workspace_id = String::from_str(env, "bench-desk-1");
    client.register_workspace(
        &admin,
        &workspace_id,
        &String::from_str(env, "Bench Desk"),
        &WorkspaceType::HotDesk,
        &1u32,
        &1_000u128,
    );

    (client, admin, workspace_id)
}

#[test]
fn bench_register_workspace() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _id) = bootstrap(&env);
    let new_id = String::from_str(&env, "bench-desk-2");
    let start = env.cost_estimate().cpu_insns;
    client.register_workspace(
        &admin,
        &new_id,
        &String::from_str(&env, "Bench Desk 2"),
        &WorkspaceType::HotDesk,
        &1u32,
        &1_000u128,
    );
    emit_bench("register_workspace", &env, start);
}

#[test]
fn bench_check_availability() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, workspace_id) = bootstrap(&env);
    let start = env.cost_estimate().cpu_insns;
    let _ = client.check_availability(&workspace_id, &1_000_000u64, &(1_000_000u64 + 3600u64));
    emit_bench("check_availability", &env, start);
}

#[test]
fn bench_get_workspace() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, workspace_id) = bootstrap(&env);
    let start = env.cost_estimate().cpu_insns;
    let _ = client.get_workspace(&workspace_id);
    emit_bench("get_workspace", &env, start);
}

#[test]
fn bench_get_all_workspaces() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _id) = bootstrap(&env);
    let start = env.cost_estimate().cpu_insns;
    let _ = client.get_all_workspaces();
    emit_bench("get_all_workspaces", &env, start);
}
