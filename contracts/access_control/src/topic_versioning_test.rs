//! Event-topic shape tests (issue #76).
//!
//! These tests do NOT just assert non-empty events. They inspect the
//! first element of each topic tuple and confirm it equals the version
//! string `EVENT_VERSION`, so a future careless revert to plain
//! `symbol_short!("...")` produce a loud test failure.

use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, String, Vec,
};

/// Mirrors the contract's published `EVENT_VERSION`. If the contract
/// bumps this to `v2`, update this assertion too.
const EXPECTED_VERSION: &str = "v1";

#[test]
fn test_event_topics_include_v1_string() {
    let env = Env::default();
    let contract_id = env.register(crate::AccessControl, ());
    let admin = Address::generate(&env);

    env.as_contract(&contract_id, || {
        crate::access_control::AccessControlModule::initialize(
            &env,
            admin.clone(),
            None,
        )
        .unwrap();
    });

    let events = env.events().all();
    assert!(!events.is_empty(), "initialize must emit at least one event");

    // Walk the topics for each emitted event and ensure the first element
    // — independent of any `symbol_short!` named topics that follow — is the
    // version string. Topic elements are stored as `Val`s; we coerce to
    // `String` via `try_into_val`.
    let version = String::from_str(&env, EXPECTED_VERSION);
    let mut found_version_at_index_zero = false;
    for (topics, _data) in events.iter() {
        if let Some(first) = topics.get(0) {
            // `Val` comparison via `try_into_val::<String>()`.
            if let Ok(s) = first.try_into_val::<String>(&env) {
                if s == version {
                    found_version_at_index_zero = true;
                    break;
                }
            }
        }
    }
    assert!(
        found_version_at_index_zero,
        "expected the first element of at least one event topic to equal EVENT_VERSION (\"{EXPECTED_VERSION}\") so off-chain consumers can match by semver"
    );
}
