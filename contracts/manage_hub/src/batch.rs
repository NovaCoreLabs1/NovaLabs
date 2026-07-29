// Allow deprecated events API until migration to #[contractevent] macro
#![allow(deprecated)]

/// Semantic version of the event topic schema published by this contract.
/// Bump to `v2` when introducing breaking changes to any event payload.
/// Off-chain consumers match on this string as the **first** element of every
/// event topic. Resolves issue #76 (`Add event topic versioning for forward
/// compatibility`).
pub const EVENT_VERSION: &str = "v1";

use crate::errors::Error;
use crate::membership_token::MembershipTokenContract;
use crate::types::{BatchMintParams, BatchTransferParams, BatchUpdateParams};
use crate::validation::BatchValidator;
use soroban_sdk::{symbol_short, Env, String, Vec}; // String required by event-topic versioning (issue #76)

pub struct BatchModule;

impl BatchModule {
    /// Mints multiple tokens in a single transaction.
    /// Requires admin authorization for each mint if issue_token requires it.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `params_vec` - Vector of minting parameters for each token
    pub fn batch_mint(env: Env, params_vec: Vec<BatchMintParams>) -> Result<(), Error> {
        BatchValidator::validate_batch_size(params_vec.len())?;

        MembershipTokenContract::batch_issue_tokens(env.clone(), params_vec.clone())?;

        // Emit batch event for tracking and monitoring
        env.events().publish(
            (
                String::from_str(&env, EVENT_VERSION),
                symbol_short!("bat_mint"),
            ),
            (params_vec.len(), env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Transfers multiple tokens to different recipients in a single transaction.
    /// Requires authorization from each current token owner.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `params_vec` - Vector of transfer parameters for each token
    pub fn batch_transfer(env: Env, params_vec: Vec<BatchTransferParams>) -> Result<(), Error> {
        BatchValidator::validate_batch_size(params_vec.len())?;

        MembershipTokenContract::batch_transfer_tokens(env.clone(), params_vec.clone())?;

        // Emit batch event for tracking and monitoring
        env.events().publish(
            (
                String::from_str(&env, EVENT_VERSION),
                symbol_short!("bat_xfr"),
            ),
            (params_vec.len(), env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Updates metadata for multiple tokens in a single transaction.
    /// Requires authorization from each token owner (or admin).
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `params_vec` - Vector of update parameters for each token
    pub fn batch_update(env: Env, params_vec: Vec<BatchUpdateParams>) -> Result<(), Error> {
        BatchValidator::validate_batch_size(params_vec.len())?;

        MembershipTokenContract::batch_set_token_metadata(env.clone(), params_vec.clone())?;

        // Emit batch event for tracking and monitoring
        env.events().publish(
            (
                String::from_str(&env, EVENT_VERSION),
                symbol_short!("bat_upd"),
            ),
            (params_vec.len(), env.ledger().timestamp()),
        );

        Ok(())
    }
}
