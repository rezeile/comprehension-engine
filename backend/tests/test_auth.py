#!/usr/bin/env python3
"""
Test script for authentication functionality
"""

def test_auth_imports():
    """Test if all auth modules can be imported"""
    try:
        print("Testing authentication imports...")
        
        from auth.jwt_handler import create_access_token, create_refresh_token, verify_token
        print("✅ JWT handler imports successful")
        
        from auth.oauth import google_oauth, create_user_from_google
        print("✅ OAuth handler imports successful")
        
        from auth.dependencies import get_current_user, get_current_active_user
        print("✅ Auth dependencies imports successful")
        
        from auth.schemas import UserResponse, TokenResponse, GoogleUserInfo
        print("✅ Auth schemas imports successful")
        
        from api.auth_routes import router
        print("✅ Auth routes imports successful")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_jwt_functionality():
    """Test JWT token creation and verification"""
    try:
        print("\nTesting JWT functionality...")
        
        from auth.jwt_handler import create_access_token, create_refresh_token, verify_token
        
        # Test data
        test_data = {"sub": "test-user-id", "email": "test@example.com"}
        
        # Create tokens
        access_token = create_access_token(test_data)
        refresh_token = create_refresh_token(test_data)
        
        print("✅ Token creation successful")
        
        # Verify tokens
        access_payload = verify_token(access_token, "access")
        refresh_payload = verify_token(refresh_token, "refresh")
        
        if access_payload and refresh_payload:
            print("✅ Token verification successful")
            print(f"   Access token payload: {access_payload}")
            return True
        else:
            print("❌ Token verification failed")
            return False
            
    except Exception as e:
        print(f"❌ JWT test error: {e}")
        return False

def test_auth_status():
    """Test authentication status endpoint"""
    try:
        print("\nTesting auth status...")
        
        import requests
        response = requests.get("http://localhost:8000/api/auth/status")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Auth status endpoint working")
            print(f"   Google OAuth configured: {data.get('google_oauth_configured')}")
            print(f"   JWT configured: {data.get('jwt_configured')}")
            return True
        else:
            print(f"❌ Auth status endpoint failed: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure FastAPI is running.")
        return False
    except Exception as e:
        print(f"❌ Auth status test error: {e}")
        return False

if __name__ == "__main__":
    print("🔐 Testing Authentication System\n")
    
    # Test imports
    imports_ok = test_auth_imports()
    
    # Test JWT functionality
    jwt_ok = test_jwt_functionality()
    
    # Test auth status endpoint (requires server to be running)
    status_ok = test_auth_status()
    
    print("\n" + "="*50)
    print("AUTHENTICATION TEST SUMMARY:")
    print(f"Imports: {'✅ PASS' if imports_ok else '❌ FAIL'}")
    print(f"JWT: {'✅ PASS' if jwt_ok else '❌ FAIL'}")
    print(f"Status Endpoint: {'✅ PASS' if status_ok else '❌ FAIL'}")
    
    if imports_ok and jwt_ok:
        print("\n🎉 Authentication system is ready!")
        print("\nNext steps:")
        print("1. Install dependencies: python install_auth_deps.py")
        print("2. Set up Google OAuth credentials")
        print("3. Add environment variables to .env file")
        print("4. Restart FastAPI server")
    else:
        print("\n❌ Authentication system needs fixes")
