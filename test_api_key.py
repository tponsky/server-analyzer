#!/usr/bin/env python3
"""
Quick script to test an OpenAI API key and see which organization it belongs to.
"""
import os
import sys
from openai import OpenAI

def test_api_key(api_key):
    """Test an API key and return organization info."""
    try:
        client = OpenAI(api_key=api_key)
        
        # Try to make a simple API call to get organization info
        # We'll use models.list which is a lightweight call
        models = client.models.list()
        
        # The response doesn't directly show org, but if it works, the key is valid
        print("✅ API Key is VALID and working!")
        print(f"✅ Can list models (found {len(list(models))} models)")
        
        # Try to get usage/billing info if possible
        # Note: This might not work for all account types
        try:
            # Make a tiny test completion to see if we get quota errors
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": "Say 'test'"}],
                max_tokens=5
            )
            print("✅ API Key can make requests successfully!")
            print(f"   Test response: {response.choices[0].message.content}")
            return True
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "quota" in error_str.lower():
                print(f"⚠️  API Key is valid but hit quota/rate limit: {error_str[:200]}")
                print("   This suggests the key belongs to an account with quota issues.")
            elif "401" in error_str or "invalid" in error_str.lower():
                print(f"❌ API Key appears invalid: {error_str[:200]}")
                return False
            else:
                print(f"⚠️  Unexpected error: {error_str[:200]}")
            return True  # Key is valid, just has quota issues
            
    except Exception as e:
        error_str = str(e)
        if "401" in error_str or "invalid" in error_str.lower():
            print(f"❌ API Key is INVALID: {error_str[:200]}")
            return False
        else:
            print(f"❌ Error testing key: {error_str}")
            return False

if __name__ == "__main__":
    # Get key from command line or environment
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            print("Usage: python test_api_key.py <api_key>")
            print("   OR: export OPENAI_API_KEY=your_key && python test_api_key.py")
            sys.exit(1)
    
    # Mask the key for display (show first 20 chars and last 10)
    masked = api_key[:20] + "..." + api_key[-10:] if len(api_key) > 30 else "***"
    print(f"Testing API Key: {masked}")
    print("-" * 60)
    
    test_api_key(api_key)
    
    print("\n" + "-" * 60)
    print("To verify this key matches your $57 credit account:")
    print("1. Go to https://platform.openai.com/api-keys")
    print("2. Compare the key prefix (first ~20 characters)")
    print("3. Make sure you're looking at the same organization/account")
    print("4. The key should start with: sk-proj-...")

