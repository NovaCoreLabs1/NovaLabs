# Common Types Library

A shared utility library defining common enums, structs, validation helpers, and constants used across all NovaLabs smart contracts.

## Overview

This is a pure library crate (no on-chain contract) that provides reusable types for the NovaLabs ecosystem. It ensures consistency across contracts by centralizing type definitions and validation logic.

## Features

- **Shared Type Definitions**: Common enums and structs used across contracts
- **Validation Helpers**: Input validation utilities for text, descriptions, and attributes
- **Constants**: Configurable limits for text lengths and attribute counts
- **Tier System Types**: Subscription plans, tiers, and feature access types
- **Attendance Types**: User attendance tracking and analytics types

## Types

### Membership & Subscriptions
- `MembershipStatus` - User membership state
- `SubscriptionPlan` - Subscription plan details
- `SubscriptionTier` - Tier configuration
- `TierLevel` - Tier hierarchy levels
- `TierFeature` - Feature definitions per tier
- `TierPromotion` - Promotional offers
- `TierChangeRequest` - Tier upgrade/downgrade requests

### Token & Metadata
- `TokenMetadata` - Token metadata structure
- `MetadataValue` - Generic metadata value type
- `UserRole` - User role assignments

### Attendance
- `AttendanceAction` - Check-in/check-out actions
- `AttendanceFrequency` - Attendance frequency categories
- `DayPattern` - Weekly attendance patterns
- `PeakHourData` - Peak usage hour analytics
- `DateRange` - Date range utilities
- `TimePeriod` - Time period definitions
- `UserAttendanceStats` - User attendance statistics

### Validation Constants
- `MAX_ATTRIBUTES_COUNT` - Maximum metadata attributes
- `MAX_ATTRIBUTE_KEY_LENGTH` - Maximum attribute key length
- `MAX_DESCRIPTION_LENGTH` - Maximum description length
- `MAX_TEXT_VALUE_LENGTH` - Maximum text value length

## Usage

Add to your `Cargo.toml`:
```toml
[dependencies]
common_types = { path = "../common_types" }
soroban-sdk = { workspace = true }
```

### Example

```rust
use common_types::{UserRole, MembershipStatus};

// Use shared types in your contract
let role = UserRole::Member;
let status = MembershipStatus::Active;
```

## Testing

```bash
cargo test -p common_types
```

## License

Part of the NovaLabs project.
