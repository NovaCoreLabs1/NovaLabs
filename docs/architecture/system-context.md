# NovaLabs System Architecture

## Overview

NovaLabs is a membership-based platform built on the Stellar blockchain using Soroban smart contracts. The system manages workspace bookings, membership tokens, payment escrows, and resource credits.

## C4 System Context Diagram

```mermaid
C4Context
    title NovaLabs System Context

    Person(member, "Member", "A user who books workspaces and manages their membership")
    Person(admin, "Admin", "Platform administrator who manages workspaces and users")

    System(novalabs, "NovaLabs Platform", "Membership-based workspace booking platform on Stellar")

    System_Ext(stellar, "Stellar Blockchain", "Decentralized payment network")
    System_Ext(usdc, "USDC Token", "Stablecoin for payments")

    Rel(member, novalabs, "Books workspaces, manages membership")
    Rel(admin, novalabs, "Manages workspaces, users, and platform")
    Rel(novalabs, stellar, "Records transactions and state")
    Rel(novalabs, usdc, "Processes payments")
```

## C4 Container Diagram

```mermaid
C4Container
    title NovaLabs Container Diagram

    Person(member, "Member", "Workspace user")
    Person(admin, "Admin", "Platform admin")

    Container_Boundary(novalabs, "NovaLabs Platform") {
        Container(manage_hub, "Manage Hub", "Soroban Contract", "Central orchestrator for all platform operations")
        Container(membership_token, "Membership Token", "Soroban Contract", "Standalone token management")
        Container(workspace_booking, "Workspace Booking", "Soroban Contract", "Workspace reservation system")
        Container(payment_escrow, "Payment Escrow", "Soroban Contract", "Secure payment holding")
        Container(resource_credits, "Resource Credits", "Soroban Contract", "Internal credit system")
        Container(access_control, "Access Control", "Soroban Contract", "Role-based access control")
        Container(common_types, "Common Types", "Rust Library", "Shared type definitions")
    }

    System_Ext(stellar, "Stellar Blockchain", "Payment network")

    Rel(member, manage_hub, "Uses platform features")
    Rel(admin, manage_hub, "Manages platform")
    Rel(manage_hub, access_control, "Checks permissions")
    Rel(manage_hub, membership_token, "Manages tokens")
    Rel(workspace_booking, payment_escrow, "Creates escrows")
    Rel(workspace_booking, common_types, "Uses shared types")
    Rel(manage_hub, common_types, "Uses shared types")
    Rel(manage_hub, stellar, "Records transactions")
```

## C4 Component Diagram (Manage Hub)

```mermaid
C4Component
    title Manage Hub Components

    Container_Ext(access_control, "Access Control", "RBAC system")
    Container_Ext(membership_token, "Membership Token", "Token contract")
    Container_Ext(common_types, "Common Types", "Shared library")

    Component_Boundary(hub, "Manage Hub Contract") {
        Component(token_ops, "Token Operations", "issue, transfer, get", "Core token management")
        Component(subscription_ops, "Subscription Operations", "create, renew, cancel", "Subscription lifecycle")
        Component(tier_ops, "Tier Operations", "create, update, get", "Tier management")
        Component(attendance_ops, "Attendance Operations", "log, get, analyze", "Attendance tracking")
        Component(staking_ops, "Staking Operations", "stake, unstake, config", "Token staking")
        Component(emergency_ops, "Emergency Operations", "pause, unpause", "Security controls")
    }

    Rel(token_ops, access_control, "Checks permissions")
    Rel(token_ops, membership_token, "Mints tokens")
    Rel(subscription_ops, tier_ops, "Uses tier config")
    Rel(attendance_ops, common_types, "Uses types")
```

## Key Components

### Smart Contracts

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| **Manage Hub** | Central orchestrator | Token ops, subscriptions, tiers, attendance |
| **Membership Token** | Token management | Issue, transfer, get |
| **Workspace Booking** | Reservation system | Book, cancel, check availability |
| **Payment Escrow** | Secure payments | Create, release, refund, dispute |
| **Resource Credits** | Internal currency | Mint, transfer, spend |
| **Access Control** | RBAC | Set role, check access, require access |

### Data Flow

1. **Member Registration**: Member → Manage Hub → Access Control → Membership Token
2. **Workspace Booking**: Member → Workspace Booking → Payment Escrow → USDC
3. **Attendance Logging**: Member → Manage Hub → Attendance Storage
4. **Subscription Management**: Member → Manage Hub → Tier Config → Subscription Storage

## Security Model

- **Role-Based Access Control**: Admin > Member > Guest hierarchy
- **Reentrancy Guards**: All fund-moving operations protected
- **Multisig Support**: Critical operations require multi-party approval
- **Emergency Pause**: Contract-wide pause for security incidents

## Deployment

Contracts are deployed on the Stellar blockchain using the Stellar CLI:

```bash
# Build contracts
cd contracts
stellar contract build

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/manage_hub.wasm \
  --source-account admin \
  --network testnet
```

## Testing

```bash
# Run all tests
cargo test --workspace

# Run specific contract tests
cargo test -p manage_hub
cargo test -p workspace_booking
cargo test -p payment_escrow
```
