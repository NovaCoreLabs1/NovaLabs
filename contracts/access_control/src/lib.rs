// contracts/access_control/src/lib.rs
#![no_std]
// Allow deprecated events API until migration to #[contractevent] macro
#![allow(deprecated)]

/// Semantic version of the event topic schema published by this contract.
/// Bump to `v2` when introducing breaking changes to any event payload.
/// Off-chain consumers match on this string as the **first** element of every
/// event topic. Resolves issue #76 (`Add event topic versioning for forward
/// compatibility`).
pub const EVENT_VERSION: &str = "v1";

mod access_control;
mod errors;
pub mod types;

#[cfg(test)]
mod access_control_tests;

#[cfg(test)]
mod topic_versioning_test;

pub use access_control::{AccessControl, AccessControlModule};
pub use errors::AccessControlError;
