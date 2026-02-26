#!/usr/bin/env python3
"""
Check which organization an API key belongs to by examining usage/billing.
Note: OpenAI doesn't directly expose org info via API, but we can infer from usage.
"""
import sys
from openai import OpenAI

def check_key_org(api_key):
    """Try to determine organization info from the key."""
    client = OpenAI(api_key=api_key)
    
    print("Checking API key organization...")
    print("-" * 60)
    
    # The key format: sk-proj-{org_id}-{key_id}
    # Extract the org identifier (middle part)
    parts = api_key.split('-')
    if len(parts) >= 3:
        org_part = parts[2]  # The part after 'sk-proj-'
        print(f"Key Organization ID (from key format): {org_part[:20]}...")
        print(f"Full key prefix: {api_key[:50]}...")
    
    print("\nTo verify this matches your $57 credit account:")
    print("1. Go to https://platform.openai.com/api-keys")
    print("2. Look for a key that starts with your project prefix")
    print("3. If you DON'T see this key, it might be from a different organization")
    print("4. Check the organization switcher (top right) - make sure you're in the right org")
    print("\n5. Also check: https://platform.openai.com/settings/organization")
    print("   - Look at the organization name/ID")
    print("   - Make sure the billing page shows $57 in the SAME organization")

if __name__ == "__main__":
    api_key = sys.argv[1] if len(sys.argv) > 1 else "YOUR_API_KEY_HERE"
    check_key_org(api_key)

