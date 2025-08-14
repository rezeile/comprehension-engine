#!/usr/bin/env python3
"""
Test script for the prompt management system.
Run this to verify that Phase 1 implementation is working correctly.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from prompts import prompt_manager
from config import prompt_settings


def test_basic_functionality():
    """Test basic prompt management functionality."""
    print("🧪 Testing Basic Prompt Management Functionality")
    print("=" * 50)
    
    # Test 1: Check if default prompt is loaded
    print("\n1. Testing default prompt loading...")
    try:
        default_prompt = prompt_manager.get_active_prompt()
        print(f"✅ Default prompt loaded successfully")
        print(f"   Length: {len(default_prompt)} characters")
        print(f"   Active variant: {prompt_manager.get_active_variant_name()}")
    except Exception as e:
        print(f"❌ Failed to load default prompt: {e}")
        return False
    
    # Test 2: Check prompt variants
    print("\n2. Testing prompt variants...")
    try:
        variants = prompt_manager.list_variants()
        print(f"✅ Found {len(variants)} prompt variants: {variants}")
        
        for variant_name in variants:
            variant_info = prompt_manager.get_variant_info(variant_name)
            print(f"   - {variant_name}: {variant_info['metadata'].get('description', 'No description')}")
    except Exception as e:
        print(f"❌ Failed to list variants: {e}")
        return False
    
    # Test 3: Check configuration
    print("\n3. Testing configuration...")
    try:
        config = prompt_settings.get_config_summary()
        print(f"✅ Configuration loaded successfully")
        print(f"   Default variant: {config['default_variant']}")
        print(f"   Experiment mode: {config['experiment_mode']}")
        print(f"   Cache enabled: {config['cache_enabled']}")
    except Exception as e:
        print(f"❌ Failed to load configuration: {e}")
        return False
    
    return True


def test_prompt_switching():
    """Test prompt variant switching."""
    print("\n🔄 Testing Prompt Variant Switching")
    print("=" * 50)
    
    # Test 1: Get current active variant
    print("\n1. Current active variant...")
    try:
        current_variant = prompt_manager.get_active_variant_name()
        print(f"✅ Currently active: {current_variant}")
    except Exception as e:
        print(f"❌ Failed to get active variant: {e}")
        return False
    
    # Test 2: Try to switch to the same variant (should work)
    print("\n2. Testing switch to current variant...")
    try:
        success = prompt_manager.set_active_variant(current_variant)
        if success:
            print(f"✅ Successfully switched to {current_variant}")
        else:
            print(f"❌ Failed to switch to {current_variant}")
            return False
    except Exception as e:
        print(f"❌ Error switching variants: {e}")
        return False
    
    # Test 3: Verify prompt content is still accessible
    print("\n3. Verifying prompt content...")
    try:
        prompt_content = prompt_manager.get_active_prompt()
        if prompt_content and len(prompt_content) > 100:
            print(f"✅ Prompt content accessible and valid ({len(prompt_content)} chars)")
        else:
            print(f"❌ Prompt content seems invalid or empty")
            return False
    except Exception as e:
        print(f"❌ Failed to get prompt content: {e}")
        return False
    
    return True


def test_error_handling():
    """Test error handling for invalid operations."""
    print("\n🚨 Testing Error Handling")
    print("=" * 50)
    
    # Test 1: Try to activate non-existent variant
    print("\n1. Testing activation of non-existent variant...")
    try:
        success = prompt_manager.set_active_variant("non_existent_variant")
        if not success:
            print("✅ Correctly rejected non-existent variant")
        else:
            print("❌ Should have rejected non-existent variant")
            return False
    except Exception as e:
        print(f"✅ Correctly handled error: {e}")
    
    # Test 2: Try to get info for non-existent variant
    print("\n2. Testing info retrieval for non-existent variant...")
    try:
        info = prompt_manager.get_variant_info("non_existent_variant")
        if info is None:
            print("✅ Correctly returned None for non-existent variant")
        else:
            print("❌ Should have returned None for non-existent variant")
            return False
    except Exception as e:
        print(f"✅ Correctly handled error: {e}")
    
    return True


def main():
    """Run all tests."""
    print("🚀 Starting Prompt Management System Tests")
    print("=" * 60)
    
    tests = [
        ("Basic Functionality", test_basic_functionality),
        ("Prompt Switching", test_prompt_switching),
        ("Error Handling", test_error_handling)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if test_func():
                print(f"✅ {test_name} PASSED")
                passed += 1
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} FAILED with exception: {e}")
    
    print(f"\n{'='*60}")
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Phase 1 implementation is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
