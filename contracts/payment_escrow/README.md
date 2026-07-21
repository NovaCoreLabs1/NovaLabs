# Payment Escrow Contract

A secure payment escrow contract that holds funds in trust between depositors and beneficiaries.

## Overview

The Payment Escrow contract manages funds during transactions, ensuring both parties are protected. Funds are locked on creation and released based on conditions or dispute resolution.

## Features

- **Secure Fund Holding**: Funds locked in contract until release conditions are met
- **Dispute Resolution**: Configurable dispute window with admin resolution
- **Auto-Claim**: Beneficiaries can self-claim after a configurable release period
- **Reentrancy Protection**: Guards against reentrancy attacks on all fund operations
- **Event Emission**: Full audit trail for all state transitions

## Public Functions

| Function | Description | Access |
|----------|-------------|--------|
| `initialize(admin, payment_token, dispute_window)` | Initialize contract | Admin (once) |
| `set_dispute_window(window)` | Update dispute window | Admin |
| `create_escrow(depositor, id, beneficiary, amount, description, release_after)` | Create escrow | Depositor |
| `release(caller, escrow_id)` | Release funds to beneficiary | Admin |
| `refund(caller, escrow_id)` | Refund funds to depositor | Admin |
| `raise_dispute(caller, escrow_id)` | Raise dispute | Depositor |
| `resolve_dispute(caller, escrow_id, release_to_beneficiary)` | Resolve dispute | Admin |
| `claim(caller, escrow_id)` | Beneficiary self-claims | Beneficiary |
| `get_escrow(escrow_id)` | Get escrow details | Public |
| `get_depositor_escrows(depositor)` | List depositor's escrows | Public |
| `get_beneficiary_escrows(beneficiary)` | List beneficiary's escrows | Public |

## Escrow States

```
Created → Released
       → Refunded
       → Disputed → Resolved (to beneficiary or depositor)
       → Claimed (after release_after)
```

## Usage

### Create an Escrow

```rust
use payment_escrow::PaymentEscrow;

PaymentEscrow::create_escrow(
    env,
    depositor,
    escrow_id,
    beneficiary,
    amount,
    description,
    release_after_timestamp,
)?;
```

### Release Funds

```rust
// Admin releases funds to beneficiary
PaymentEscrow::release(env, admin, escrow_id)?;
```

### Raise a Dispute

```rust
// Depositor raises dispute within dispute window
PaymentEscrow::raise_dispute(env, depositor, escrow_id)?;
```

### Claim Funds

```rust
// Beneficiary claims after release_after has passed
PaymentEscrow::claim(env, beneficiary, escrow_id)?;
```

## Testing

```bash
cargo test -p payment_escrow
```

## Security Considerations

- Reentrancy guards on all fund-moving operations
- Dispute window prevents immediate fund release
- Admin authorization required for releases and refunds
- Event emission for full audit trail

## License

Part of the NovaLabs project.
