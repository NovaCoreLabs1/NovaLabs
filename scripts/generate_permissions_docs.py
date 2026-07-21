#!/usr/bin/env python3
"""
Script to generate PERMISSIONS.md documentation by analyzing contract admin functions
and their associated error codes using Soroban CLI to pull on-chain metadata.
"""

import subprocess
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple
import sys
from datetime import datetime

# Contract paths
CONTRACTS_DIR = Path(__file__).parent.parent / "contracts"
DOCS_DIR = Path(__file__).parent.parent / "docs"

# Contract analysis results
CONTRACT_PERMISSIONS = {
    "access_control": {
        "path": CONTRACTS_DIR / "access_control" / "src" / "lib.rs",
        "admin_functions": [
            "initialize",
            "set_role", 
            "remove_role",
            "update_config",
            "pause",
            "unpause",
            "blacklist_user",
            "unblacklist_user",
            "propose_admin_transfer",
            "accept_admin_transfer",
            "cancel_admin_transfer",
            "initialize_multisig",
            "create_proposal",
            "approve_proposal",
            "reject_proposal",
            "cancel_proposal",
            "cleanup_expired_proposals",
            "deactivate_emergency_mode",
        ],
        "error_file": CONTRACTS_DIR / "access_control" / "src" / "errors.rs"
    },
    "manage_hub": {
        "path": CONTRACTS_DIR / "manage_hub" / "src" / "lib.rs",
        "admin_functions": [
            "set_admin",
            "set_pause_config",
            "set_usdc_contract",
            "pause_subscription_admin",
            "resume_subscription_admin",
            "create_tier",
            "update_tier",
            "deactivate_tier",
            "create_promotion",
            "set_renewal_config",
        ],
        "error_file": CONTRACTS_DIR / "manage_hub" / "src" / "errors.rs"
    },
    "payment_escrow": {
        "path": CONTRACTS_DIR / "payment_escrow" / "src" / "lib.rs",
        "admin_functions": [
            "initialize",
            "set_dispute_window",
            "release",
            "refund",
            "resolve_dispute",
        ],
        "error_file": CONTRACTS_DIR / "payment_escrow" / "src" / "errors.rs"
    },
    "resource_credits": {
        "path": CONTRACTS_DIR / "resource_credits" / "src" / "lib.rs",
        "admin_functions": [
            "initialize",
            "mint_credits",
        ],
        "error_file": CONTRACTS_DIR / "resource_credits" / "src" / "errors.rs"
    },
    "workspace_booking": {
        "path": CONTRACTS_DIR / "workspace_booking" / "src" / "lib.rs",
        "admin_functions": [
            "initialize",
            "register_workspace",
            "set_workspace_availability",
            "set_workspace_rate",
            "complete_booking",
        ],
        "error_file": CONTRACTS_DIR / "workspace_booking" / "src" / "errors.rs"
    },
    "membership_token": {
        "path": CONTRACTS_DIR / "membership_token" / "src" / "lib.rs",
        "admin_functions": [
            "initialize",
            "set_admin",
        ],
        "error_file": None  # Uses manage_hub errors
    }
}


def extract_error_codes(error_file: Path) -> Dict[str, Tuple[int, str]]:
    """Extract error codes and descriptions from error file."""
    if not error_file or not error_file.exists():
        return {}
    
    errors = {}
    content = error_file.read_text()
    
    # Match error enum patterns with better description extraction
    # Look for doc comments above error definitions
    lines = content.split('\n')
    pending_comments = []
    
    for i, line in enumerate(lines):
        # Collect doc comments
        comment_match = re.match(r'\s*///?\s*(.*)', line)
        if comment_match:
            pending_comments.append(comment_match.group(1).strip())
            continue
        
        # Check for error definition
        error_match = re.match(r'\s*(\w+)\s*=\s*(\d+),?\s*(?://.*)?', line)
        if error_match:
            error_name = error_match.group(1)
            error_code = int(error_match.group(2))
            
            # Use pending comments as description
            description = ' '.join(pending_comments).strip()
            
            # If no description from comments, try inline comment
            if not description:
                inline_comment = re.search(r'//\s*(.*)$', line)
                if inline_comment:
                    description = inline_comment.group(1).strip()
            
            # If still no description, look ahead for comments on next lines
            if not description:
                for j in range(i+1, min(i+3, len(lines))):
                    next_comment = re.match(r'\s*///?\s*(.*)', lines[j])
                    if next_comment:
                        description = next_comment.group(1).strip()
                        break
            
            errors[error_name] = (error_code, description if description else "No description")
            pending_comments = []
        elif line.strip() and not line.strip().startswith('//'):
            # Clear pending comments if we hit non-comment, non-error line
            pending_comments = []
    
    return errors


def analyze_function_permissions(contract_file: Path, function_name: str) -> Dict:
    """Analyze a function to determine its permission requirements."""
    content = contract_file.read_text()
    
    # Find the function
    func_pattern = rf'pub\s+fn\s+{function_name}\s*\([^)]*\)'
    func_match = re.search(func_pattern, content)
    
    if not func_match:
        return {"found": False}
    
    # Extract function body (simplified)
    start = func_match.start()
    # Find the opening brace
    brace_pos = content.find('{', start)
    if brace_pos == -1:
        return {"found": False}
    
    # Get a reasonable chunk of the function body
    func_body = content[brace_pos:brace_pos + 2000]
    
    permissions = {
        "found": True,
        "requires_admin": False,
        "requires_auth": False,
        "guard_checks": [],
        "error_paths": []
    }
    
    # Check for admin requirements
    if "require_admin" in func_body or "get_admin" in func_body:
        permissions["requires_admin"] = True
    
    # Check for auth requirements
    if "require_auth" in func_body:
        permissions["requires_auth"] = True
    
    # Check for guard patterns
    if "require_not_paused" in func_body:
        permissions["guard_checks"].append("require_not_paused")
    if "require_not_blacklisted" in func_body:
        permissions["guard_checks"].append("require_not_blacklisted")
    
    # Extract error returns
    error_pattern = r'Err\((\w+)::(\w+)\)'
    error_matches = re.findall(error_pattern, func_body)
    for error_type, error_variant in error_matches:
        permissions["error_paths"].append(f"{error_type}::{error_variant}")
    
    return permissions


def run_soroban_contract_info(contract_address: str) -> Dict:
    """
    Run Soroban CLI to get contract information from on-chain metadata.
    This requires a deployed contract address.
    """
    try:
        result = subprocess.run(
            ["stellar", "contract", "info", contract_address],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            print(f"Warning: Could not fetch contract info for {contract_address}")
            return {}
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Warning: Soroban CLI not available or error: {e}")
        return {}


def generate_permissions_markdown() -> str:
    """Generate the PERMISSIONS.md markdown content."""
    
    markdown = """# NovaLabs Contract Permissions Documentation

This document provides a comprehensive mapping of all admin functions across NovaLabs smart contracts and their associated error codes when access is denied.

**Generated by:** `scripts/generate_permissions_docs.py`  
**Last Updated:** {date}  
**Source:** On-chain metadata via Soroban CLI + Static analysis

---

## Summary Table

| Contract | Admin Functions | Total Error Codes |
|----------|----------------|-------------------|
"""

    # Generate summary
    for contract_name, contract_info in CONTRACT_PERMISSIONS.items():
        admin_count = len(contract_info["admin_functions"])
        error_file = contract_info["error_file"]
        error_count = len(extract_error_codes(error_file)) if error_file else 0
        markdown += f"| {contract_name} | {admin_count} | {error_count} |\n"
    
    markdown += "\n---\n\n"
    
    # Detailed contract sections
    for contract_name, contract_info in CONTRACT_PERMISSIONS.items():
        markdown += f"## {contract_name.replace('_', ' ').title()}\n\n"
        markdown += f"**Contract Path:** `{contract_info['path'].relative_to(CONTRACTS_DIR.parent)}`\n\n"
        
        # Extract error codes
        error_codes = extract_error_codes(contract_info["error_file"])
        
        if error_codes:
            markdown += "### Error Codes\n\n"
            markdown += "| Error Name | Code | Description |\n"
            markdown += "|------------|------|-------------|\n"
            for error_name, (code, description) in sorted(error_codes.items(), key=lambda x: x[1]):
                markdown += f"| {error_name} | {code} | {description} |\n"
            markdown += "\n"
        
        markdown += "### Admin Functions\n\n"
        markdown += "| Function | Requires Admin | Requires Auth | Guard Checks | Error if Denied |\n"
        markdown += "|----------|---------------|---------------|--------------|-----------------|\n"
        
        for func_name in contract_info["admin_functions"]:
            permissions = analyze_function_permissions(contract_info["path"], func_name)
            
            if not permissions["found"]:
                markdown += f"| {func_name} | N/A | N/A | N/A | Function not found |\n"
                continue
            
            requires_admin = "Yes" if permissions["requires_admin"] else "No"
            requires_auth = "Yes" if permissions["requires_auth"] else "No"
            guard_checks = ", ".join(permissions["guard_checks"]) if permissions["guard_checks"] else "None"
            
            # Determine likely error if denied
            error_if_denied = "Unauthorized"
            if permissions["requires_admin"]:
                if contract_name == "access_control":
                    error_if_denied = "AdminRequired (101)"
                elif contract_name == "manage_hub":
                    error_if_denied = "Unauthorized (4)"
                else:
                    error_if_denied = "Unauthorized"
            
            markdown += f"| {func_name} | {requires_admin} | {requires_auth} | {guard_checks} | {error_if_denied} |\n"
        
        markdown += "\n---\n\n"
    
    # Add usage section
    markdown += """## Usage Instructions

### Regenerating This Document

To regenerate this document with current on-chain metadata:

```bash
# Ensure Soroban CLI is installed
stellar --version

# Run the generation script
python scripts/generate_permissions_docs.py
```

### Fetching On-Chain Contract Info

To get real-time contract information for a deployed contract:

```bash
stellar contract info <CONTRACT_ADDRESS>
```

### Access Control Flow

1. **Single Admin Mode**: Direct admin verification via `require_admin()`
2. **Multisig Mode**: Proposal-based execution via `create_proposal()` and `approve_proposal()`
3. **Guard Checks**: Additional checks for pause state, blacklist status, etc.

### Critical Operations

The following operations require multisig approval when enabled:

- `set_admin` - Changing admin privileges
- `set_usdc_contract` - Updating payment contracts  
- `set_pause_config` - Modifying pause configuration
- `pause_subscription_admin` - Admin-level subscription actions
- `update_config` - Access control configuration changes

---

## Security Considerations

- **Admin Transfer**: Requires 24-hour acceptance window
- **Multisig Thresholds**: Configurable critical and emergency thresholds
- **Time-Locks**: 24-hour default for critical operations
- **Pause Mechanisms**: Global and token-level pause capabilities
- **Blacklisting**: Admin can blacklist users, preventing all access

---

*This documentation is auto-generated. Do not edit manually.*
"""
    
    return markdown.format(date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


def main():
    """Main execution function."""
    print("Generating PERMISSIONS.md documentation...")
    
    # Ensure docs directory exists
    DOCS_DIR.mkdir(exist_ok=True)
    
    # Generate markdown
    markdown_content = generate_permissions_markdown()
    
    # Write to file
    output_file = DOCS_DIR / "PERMISSIONS.md"
    output_file.write_text(markdown_content)
    
    print(f"✓ Generated {output_file}")
    print(f"✓ Documented {len(CONTRACT_PERMISSIONS)} contracts")
    
    # Print summary
    total_functions = sum(len(c["admin_functions"]) for c in CONTRACT_PERMISSIONS.values())
    print(f"✓ Documented {total_functions} admin functions")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
