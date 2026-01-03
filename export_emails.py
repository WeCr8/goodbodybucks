#!/usr/bin/env python3
"""
Export Email Captures from Firestore to CSV

This script exports all captured emails from the email_captures collection
in Firestore to a CSV file for easy import into email marketing platforms.

Usage:
    python export_emails.py

Output:
    email_captures.csv - Contains all captured emails with metadata
"""

import firebase_admin
from firebase_admin import credentials, firestore
import csv
from datetime import datetime
import sys
import os

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        # Check if already initialized
        firebase_admin.get_app()
        print("✅ Firebase already initialized")
    except ValueError:
        # Initialize with service account
        if not os.path.exists('serviceAccountKey.json'):
            print("❌ Error: serviceAccountKey.json not found!")
            print("   Please download your service account key from Firebase Console")
            sys.exit(1)
        
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized")
    
    return firestore.client()

def export_emails_to_csv(output_file='email_captures.csv'):
    """Export all email captures to CSV file"""
    print("\n📧 Exporting email captures...")
    
    db = initialize_firebase()
    
    # Fetch all email captures, ordered by timestamp (newest first)
    try:
        captures = db.collection('email_captures').order_by(
            'timestamp', 
            direction=firestore.Query.DESCENDING
        ).stream()
        
        # Convert to list to count
        captures_list = list(captures)
        
        if not captures_list:
            print("\n⚠️  No email captures found in database")
            return
        
        # Write to CSV
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['email', 'timestamp', 'source', 'userAgent', 'ipAddress']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            
            count = 0
            for doc in captures_list:
                data = doc.to_dict()
                
                # Convert timestamp to readable format
                if 'timestamp' in data and data['timestamp']:
                    data['timestamp'] = data['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                else:
                    data['timestamp'] = 'N/A'
                
                # Ensure all fields exist
                row = {
                    'email': data.get('email', ''),
                    'timestamp': data.get('timestamp', ''),
                    'source': data.get('source', ''),
                    'userAgent': data.get('userAgent', '')[:50] + '...' if len(data.get('userAgent', '')) > 50 else data.get('userAgent', ''),
                    'ipAddress': data.get('ipAddress', '')
                }
                
                writer.writerow(row)
                count += 1
        
        print(f"\n✅ Successfully exported {count} email captures to {output_file}")
        print(f"   File location: {os.path.abspath(output_file)}")
        
    except Exception as e:
        print(f"\n❌ Error exporting emails: {e}")
        sys.exit(1)

def export_emails_only(output_file='emails_only.txt'):
    """Export just the email addresses (one per line) for easy copy-paste"""
    print("\n📧 Exporting email addresses only...")
    
    db = initialize_firebase()
    
    try:
        captures = db.collection('email_captures').order_by(
            'timestamp', 
            direction=firestore.Query.DESCENDING
        ).stream()
        
        captures_list = list(captures)
        
        if not captures_list:
            print("\n⚠️  No email captures found in database")
            return
        
        with open(output_file, 'w', encoding='utf-8') as f:
            count = 0
            for doc in captures_list:
                data = doc.to_dict()
                email = data.get('email', '')
                if email:
                    f.write(email + '\n')
                    count += 1
        
        print(f"\n✅ Successfully exported {count} email addresses to {output_file}")
        print(f"   File location: {os.path.abspath(output_file)}")
        
    except Exception as e:
        print(f"\n❌ Error exporting emails: {e}")
        sys.exit(1)

def show_statistics():
    """Display statistics about email captures"""
    print("\n📊 Email Capture Statistics")
    print("=" * 50)
    
    db = initialize_firebase()
    
    try:
        # Total captures
        all_captures = list(db.collection('email_captures').stream())
        total = len(all_captures)
        print(f"Total emails captured: {total}")
        
        if total == 0:
            print("\nNo data available yet.")
            return
        
        # Captures by source
        sources = {}
        for doc in all_captures:
            data = doc.to_dict()
            source = data.get('source', 'unknown')
            sources[source] = sources.get(source, 0) + 1
        
        print("\nCaptures by source:")
        for source, count in sources.items():
            print(f"  - {source}: {count}")
        
        # Recent captures (last 7 days)
        from datetime import timedelta
        week_ago = datetime.now() - timedelta(days=7)
        recent = list(db.collection('email_captures').where('timestamp', '>=', week_ago).stream())
        print(f"\nCaptures in last 7 days: {len(recent)}")
        
        # Most recent capture
        latest = db.collection('email_captures').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).get()
        if latest:
            latest_data = latest[0].to_dict()
            latest_time = latest_data.get('timestamp', None)
            if latest_time:
                print(f"Most recent capture: {latest_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        print("=" * 50)
        
    except Exception as e:
        print(f"\n❌ Error fetching statistics: {e}")

def main():
    """Main function - export emails and show statistics"""
    print("\n" + "=" * 50)
    print("   📧 GoodbodyBucks Email Export Tool")
    print("=" * 50)
    
    # Show statistics
    show_statistics()
    
    # Export to CSV (full data)
    export_emails_to_csv('email_captures.csv')
    
    # Export emails only (for easy import)
    export_emails_only('emails_only.txt')
    
    print("\n✅ Export complete!")
    print("\nFiles created:")
    print("  1. email_captures.csv - Full data with metadata")
    print("  2. emails_only.txt - Just email addresses (one per line)")
    print("\n" + "=" * 50 + "\n")

if __name__ == '__main__':
    main()

