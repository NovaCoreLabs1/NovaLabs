#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env};

#[contract]
pub struct MembershipTokenContract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MembershipStatus {
    Active,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MembershipToken {
    pub id: BytesN<32>,
    pub user: Address,
    pub status: MembershipStatus,
    pub issue_date: u64,
    pub expiry_date: u64,
}

#[contracttype]
pub enum DataKey {
    Token(BytesN<32>),
    Admin,
    Minter,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AdminNotSet = 1,
    TokenAlreadyIssued = 2,
    InvalidExpiryDate = 3,
    TokenNotFound = 4,
    TokenExpired = 5,
    MinterNotSet = 6,
    NotAuthorized = 7,
}

#[contractimpl]
impl MembershipTokenContract {
    pub fn issue_token(
        env: Env,
        id: BytesN<32>,
        user: Address,
        expiry_date: u64,
    ) -> Result<(), Error> {
        // Check minter authorization first, fall back to admin for backward compat
        let minter: Option<Address> = env.storage().instance().get(&DataKey::Minter);

        if let Some(minter_addr) = minter {
            minter_addr.require_auth();
        } else {
            // Fallback: if no minter is set, admin can still issue tokens
            let admin: Address = env
                .storage()
                .instance()
                .get(&DataKey::Admin)
                .ok_or(Error::AdminNotSet)?;
            admin.require_auth();
        }

        if env.storage().persistent().has(&DataKey::Token(id.clone())) {
            return Err(Error::TokenAlreadyIssued);
        }

        let current_time = env.ledger().timestamp();
        if expiry_date <= current_time {
            return Err(Error::InvalidExpiryDate);
        }

        let token = MembershipToken {
            id: id.clone(),
            user: user.clone(),
            status: MembershipStatus::Active,
            issue_date: current_time,
            expiry_date,
        };
        env.storage().persistent().set(&DataKey::Token(id), &token);

        Ok(())
    }

    pub fn transfer_token(env: Env, id: BytesN<32>, new_user: Address) -> Result<(), Error> {
        let mut token: MembershipToken = env
            .storage()
            .persistent()
            .get(&DataKey::Token(id.clone()))
            .ok_or(Error::TokenNotFound)?;

        if token.status != MembershipStatus::Active {
            return Err(Error::TokenExpired);
        }

        token.user.require_auth();

        token.user = new_user;
        env.storage().persistent().set(&DataKey::Token(id), &token);

        Ok(())
    }

    pub fn get_token(env: Env, id: BytesN<32>) -> Result<MembershipToken, Error> {
        let token: MembershipToken = env
            .storage()
            .persistent()
            .get(&DataKey::Token(id))
            .ok_or(Error::TokenNotFound)?;

        let current_time = env.ledger().timestamp();
        if token.status == MembershipStatus::Active && current_time > token.expiry_date {
            return Err(Error::TokenExpired);
        }

        Ok(token)
    }

    pub fn set_admin(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Sets the minter address. Only the current admin can call this.
    /// The minter can issue tokens but cannot pause or change the admin.
    pub fn set_minter(env: Env, _admin: Address, minter: Address) -> Result<(), Error> {
        // Verify the caller is the stored admin via Soroban auth
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::AdminNotSet)?;
        stored_admin.require_auth();

        env.storage().instance().set(&DataKey::Minter, &minter);
        Ok(())
    }

    /// Returns the current minter address, if set.
    pub fn get_minter(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Minter)
    }
}

#[cfg(test)]
mod test;
