#!/usr/bin/env python3
"""
Firebase Setup Validation Script for GoodbodyBucks
This script validates that all Firebase configurations are properly set up.
"""

import os
import json
import sys
from pathlib import Path

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{text}{Colors.END}")

def print_success(text):
    print(f"{Colors.GREEN}[OK] {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}[ERROR] {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}[WARN] {text}{Colors.END}")

def check_file_exists(filename):
    """Check if a file exists and return True/False"""
    if os.path.exists(filename):
        print_success(f"{filename} found")
        return True
    else:
        print_error(f"{filename} missing")
        return False

def validate_json_file(filename):
    """Validate that a file contains valid JSON"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            json.load(f)
        print_success(f"{filename} is valid JSON")
        return True
    except json.JSONDecodeError as e:
        print_error(f"{filename} contains invalid JSON: {e}")
        return False
    except Exception as e:
        print_error(f"Error reading {filename}: {e}")
        return False

def validate_firestore_indexes():
    """Validate firestore.indexes.json structure"""
    print_header("[INDEXES] Validating Firestore Indexes")
    
    if not check_file_exists("firestore.indexes.json"):
        return False
    
    if not validate_json_file("firestore.indexes.json"):
        return False
    
    try:
        with open("firestore.indexes.json", 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if "indexes" not in data:
            print_error("Missing 'indexes' key in firestore.indexes.json")
            return False
        
        indexes = data["indexes"]
        print_success(f"Found {len(indexes)} index definitions")
        
        # Check for required indexes
        required_collections = {"purchases", "members", "ledger"}
        found_collections = {idx["collectionGroup"] for idx in indexes}
        
        missing = required_collections - found_collections
        if missing:
            print_warning(f"Missing indexes for collections: {missing}")
        else:
            print_success("All required collection indexes defined")
        
        # Validate each index structure
        for idx in indexes:
            collection = idx.get("collectionGroup", "unknown")
            fields = idx.get("fields", [])
            print(f"  • {collection}: {len(fields)} fields")
        
        return True
        
    except Exception as e:
        print_error(f"Error validating indexes: {e}")
        return False

def validate_firestore_rules():
    """Validate firestore.rules file"""
    print_header("[RULES] Validating Firestore Security Rules")
    
    if not check_file_exists("firestore.rules"):
        return False
    
    try:
        with open("firestore.rules", 'r', encoding='utf-8') as f:
            rules = f.read()
        
        # Check for required rules components
        required_patterns = [
            "rules_version",
            "service cloud.firestore",
            "function isAuthenticated",
            "function isAdminOfFamily",
            "function isMemberOfFamily",
            "match /families/{familyId}",
            "match /members/{uid}",
            "match /wallets/{uid}",
            "match /sessions/{uid}",
            "match /purchases/{purchaseId}",
            "match /ledger/{entryId}"
        ]
        
        all_present = True
        for pattern in required_patterns:
            if pattern in rules:
                print_success(f"Found: {pattern}")
            else:
                print_error(f"Missing: {pattern}")
                all_present = False
        
        return all_present
        
    except Exception as e:
        print_error(f"Error validating rules: {e}")
        return False

def validate_storage_rules():
    """Validate storage.rules file"""
    print_header("[STORAGE] Validating Storage Security Rules")
    
    if not check_file_exists("storage.rules"):
        return False
    
    try:
        with open("storage.rules", 'r', encoding='utf-8') as f:
            rules = f.read()
        
        # Check for required components
        required_patterns = [
            "rules_version",
            "service firebase.storage",
            "match /images",
            "match /families"
        ]
        
        all_present = True
        for pattern in required_patterns:
            if pattern in rules:
                print_success(f"Found: {pattern}")
            else:
                print_warning(f"Missing or different: {pattern}")
        
        return True
        
    except Exception as e:
        print_error(f"Error validating storage rules: {e}")
        return False

def validate_firebase_json():
    """Validate firebase.json configuration"""
    print_header("[CONFIG] Validating Firebase Configuration")
    
    if not check_file_exists("firebase.json"):
        return False
    
    if not validate_json_file("firebase.json"):
        return False
    
    try:
        with open("firebase.json", 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Check for required sections
        required_sections = {
            "firestore": ["rules", "indexes"],
            "storage": ["rules"],
            "hosting": ["public", "ignore"]
        }
        
        all_present = True
        for section, keys in required_sections.items():
            if section in config:
                print_success(f"Found section: {section}")
                for key in keys:
                    if key in config[section]:
                        print_success(f"  • {key}: {config[section][key]}")
                    else:
                        print_error(f"  • Missing {key} in {section}")
                        all_present = False
            else:
                print_error(f"Missing section: {section}")
                all_present = False
        
        return all_present
        
    except Exception as e:
        print_error(f"Error validating firebase.json: {e}")
        return False

def validate_service_account():
    """Check for service account key file"""
    print_header("[KEY] Validating Service Account Key")
    
    if check_file_exists("serviceAccountKey.json"):
        if validate_json_file("serviceAccountKey.json"):
            try:
                with open("serviceAccountKey.json", 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                required_keys = ["type", "project_id", "private_key", "client_email"]
                all_present = True
                for key in required_keys:
                    if key in data:
                        if key == "private_key":
                            print_success(f"{key}: [REDACTED]")
                        else:
                            print_success(f"{key}: {data[key]}")
                    else:
                        print_error(f"Missing key: {key}")
                        all_present = False
                
                return all_present
            except Exception as e:
                print_error(f"Error reading service account: {e}")
                return False
        return False
    else:
        print_warning("Service account key not found (needed for backend)")
        return False

def validate_frontend_config():
    """Check Firebase config in index.html"""
    print_header("[FRONTEND] Validating Frontend Firebase Config")
    
    if not check_file_exists("index.html"):
        return False
    
    try:
        with open("index.html", 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check for Firebase config
        if "const firebaseConfig" in content:
            print_success("Found firebaseConfig in index.html")
            
            # Check for required config keys
            config_keys = ["apiKey", "authDomain", "projectId"]
            for key in config_keys:
                if f'"{key}"' in content or f"'{key}'" in content:
                    print_success(f"  • {key} configured")
                else:
                    print_error(f"  • Missing {key}")
            
            return True
        else:
            print_error("firebaseConfig not found in index.html")
            return False
            
    except Exception as e:
        print_error(f"Error validating frontend config: {e}")
        return False

def validate_python_dependencies():
    """Check if required Python packages are installed"""
    print_header("[PYTHON] Validating Python Dependencies")
    
    required_packages = {
        "flask": "Flask",
        "firebase_admin": "firebase-admin"
    }
    
    all_installed = True
    for module, package in required_packages.items():
        try:
            __import__(module)
            print_success(f"{package} installed")
        except ImportError:
            print_error(f"{package} not installed")
            all_installed = False
    
    return all_installed

def main():
    """Run all validations"""
    # Handle Windows console encoding issues
    import io
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}Firebase Setup Validation - GoodbodyBucks{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}")
    
    results = {
        "Firestore Indexes": validate_firestore_indexes(),
        "Firestore Rules": validate_firestore_rules(),
        "Storage Rules": validate_storage_rules(),
        "Firebase Config": validate_firebase_json(),
        "Service Account": validate_service_account(),
        "Frontend Config": validate_frontend_config(),
        "Python Dependencies": validate_python_dependencies()
    }
    
    # Summary
    print_header("[SUMMARY] Validation Summary")
    passed = sum(results.values())
    total = len(results)
    
    for check, result in results.items():
        if result:
            print_success(f"{check}")
        else:
            print_error(f"{check}")
    
    print(f"\n{Colors.BOLD}Results: {passed}/{total} checks passed{Colors.END}")
    
    if passed == total:
        print_success("\nAll validations passed! Your Firebase setup is ready.")
        print("\nNext steps:")
        print("  1. Deploy to Firebase: firebase deploy --only firestore,storage")
        print("  2. Wait for indexes to build (5-15 minutes)")
        print("  3. Test your application")
        return 0
    else:
        print_error(f"\n{total - passed} validation(s) failed. Please fix the issues above.")
        print("\nRefer to FIREBASE_DEPLOYMENT_GUIDE.md for detailed setup instructions.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

