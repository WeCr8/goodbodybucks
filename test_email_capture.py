#!/usr/bin/env python3
"""
Test Email Capture API

This script tests the email capture endpoint to ensure it's working correctly.

Usage:
    python test_email_capture.py [url]

Examples:
    python test_email_capture.py                          # Test localhost
    python test_email_capture.py https://your-domain.com  # Test production
"""

import requests
import sys
import json
from datetime import datetime

def test_email_capture(base_url="http://localhost:5000"):
    """Test the email capture API endpoint"""
    
    print("\n" + "=" * 60)
    print("   📧 Testing Email Capture API")
    print("=" * 60)
    print(f"\nBase URL: {base_url}")
    
    endpoint = f"{base_url}/api/capture-email"
    test_email = f"test+{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com"
    
    # Test 1: Valid email submission
    print("\n--- Test 1: Valid Email Submission ---")
    try:
        response = requests.post(
            endpoint,
            json={"email": test_email, "source": "test_script"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 201:
            print("✅ Test 1 PASSED: Email captured successfully")
        else:
            print("❌ Test 1 FAILED: Expected status 201")
    except Exception as e:
        print(f"❌ Test 1 ERROR: {e}")
        return False
    
    # Test 2: Duplicate email submission
    print("\n--- Test 2: Duplicate Email Submission ---")
    try:
        response = requests.post(
            endpoint,
            json={"email": test_email, "source": "test_script"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Test 2 PASSED: Duplicate detected correctly")
        else:
            print("⚠️  Test 2 WARNING: Expected status 200 for duplicate")
    except Exception as e:
        print(f"❌ Test 2 ERROR: {e}")
    
    # Test 3: Invalid email format
    print("\n--- Test 3: Invalid Email Format ---")
    try:
        response = requests.post(
            endpoint,
            json={"email": "invalid-email", "source": "test_script"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 400:
            print("✅ Test 3 PASSED: Invalid email rejected")
        else:
            print("❌ Test 3 FAILED: Expected status 400")
    except Exception as e:
        print(f"❌ Test 3 ERROR: {e}")
    
    # Test 4: Missing email field
    print("\n--- Test 4: Missing Email Field ---")
    try:
        response = requests.post(
            endpoint,
            json={"source": "test_script"},  # No email field
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 400:
            print("✅ Test 4 PASSED: Missing email rejected")
        else:
            print("❌ Test 4 FAILED: Expected status 400")
    except Exception as e:
        print(f"❌ Test 4 ERROR: {e}")
    
    # Test 5: Empty request body
    print("\n--- Test 5: Empty Request Body ---")
    try:
        response = requests.post(
            endpoint,
            json={},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 400:
            print("✅ Test 5 PASSED: Empty request rejected")
        else:
            print("❌ Test 5 FAILED: Expected status 400")
    except Exception as e:
        print(f"❌ Test 5 ERROR: {e}")
    
    print("\n" + "=" * 60)
    print("   📊 Test Summary")
    print("=" * 60)
    print("\n✅ All core tests completed!")
    print(f"\nTest email used: {test_email}")
    print("\nNext Steps:")
    print("1. Check Firestore Console to verify the email was saved")
    print("2. Run: python export_emails.py")
    print("3. Verify the email appears in email_captures.csv")
    print("\n" + "=" * 60 + "\n")
    
    return True

def main():
    """Main function"""
    # Get base URL from command line or use default
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
    
    # Remove trailing slash if present
    base_url = base_url.rstrip('/')
    
    try:
        # Test if server is reachable
        response = requests.get(base_url, timeout=5)
        print(f"✅ Server is reachable at {base_url}")
    except requests.exceptions.ConnectionError:
        print(f"❌ Error: Cannot connect to {base_url}")
        print("   Make sure the backend server is running:")
        print("   python app.py")
        sys.exit(1)
    except Exception as e:
        print(f"⚠️  Warning: {e}")
    
    # Run tests
    test_email_capture(base_url)

if __name__ == '__main__':
    main()

