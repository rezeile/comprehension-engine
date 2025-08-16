#!/usr/bin/env python3
"""
Debug script to test auth components individually
"""

def test_google_oauth_config():
    """Test Google OAuth configuration"""
    try:
        print("Testing Google OAuth configuration...")
        
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        
        print(f"GOOGLE_CLIENT_ID: {'✅ Set' if google_client_id else '❌ Missing'}")
        print(f"GOOGLE_CLIENT_SECRET: {'✅ Set' if google_client_secret else '❌ Missing'}")
        
        if google_client_id:
            print(f"Client ID preview: {google_client_id[:20]}...")
        
        return bool(google_client_id and google_client_secret)
        
    except Exception as e:
        print(f"❌ OAuth config error: {e}")
        return False

def test_oauth_import():
    """Test OAuth imports"""
    try:
        print("\nTesting OAuth imports...")
        
        from auth.oauth import google_oauth, oauth
        print(f"OAuth object: {'✅ Created' if oauth else '❌ Failed'}")
        print(f"Google OAuth: {'✅ Configured' if google_oauth else '❌ Not configured'}")
        
        if google_oauth:
            print("Google OAuth client configured successfully")
        else:
            print("Google OAuth client not configured - check environment variables")
            
        return True
        
    except Exception as e:
        print(f"❌ OAuth import error: {e}")
        return False

def test_auth_routes_import():
    """Test auth routes import"""
    try:
        print("\nTesting auth routes import...")
        
        from api.auth_routes import router
        print("✅ Auth routes imported successfully")
        
        # Check if routes are registered
        routes = [route.path for route in router.routes]
        print(f"Available routes: {routes}")
        
        return True
        
    except Exception as e:
        print(f"❌ Auth routes import error: {e}")
        return False

def test_fastapi_app():
    """Test FastAPI app creation"""
    try:
        print("\nTesting FastAPI app...")
        
        from main import app
        print("✅ FastAPI app created successfully")
        
        # Check registered routes
        auth_routes = [route.path for route in app.routes if '/auth/' in route.path]
        print(f"Auth routes in app: {auth_routes}")
        
        return True
        
    except Exception as e:
        print(f"❌ FastAPI app error: {e}")
        return False

if __name__ == "__main__":
    print("🔍 DEBUGGING AUTH SYSTEM\n")
    
    # Test each component
    oauth_config_ok = test_google_oauth_config()
    oauth_import_ok = test_oauth_import()
    routes_import_ok = test_auth_routes_import()
    app_ok = test_fastapi_app()
    
    print("\n" + "="*50)
    print("DEBUG SUMMARY:")
    print(f"OAuth Config: {'✅' if oauth_config_ok else '❌'}")
    print(f"OAuth Import: {'✅' if oauth_import_ok else '❌'}")
    print(f"Routes Import: {'✅' if routes_import_ok else '❌'}")
    print(f"FastAPI App: {'✅' if app_ok else '❌'}")
    
    if all([oauth_config_ok, oauth_import_ok, routes_import_ok, app_ok]):
        print("\n🎉 All components look good!")
        print("The 500 error might be a runtime issue. Check FastAPI server logs.")
    else:
        print("\n❌ Found issues that need fixing.")
