#!/usr/bin/env python3
"""
Script to install authentication dependencies
"""
import subprocess
import sys

def install_package(package):
    """Install a package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✅ Successfully installed {package}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install {package}: {e}")
        return False

# Install the authentication dependencies
packages = [
    "authlib==1.2.1",
    "python-jose[cryptography]==3.3.0", 
    "passlib[bcrypt]==1.7.4",
    "httpx==0.24.1"
]

print("Installing authentication dependencies...")
all_success = True

for package in packages:
    success = install_package(package)
    all_success = all_success and success

if all_success:
    print("\n🎉 All authentication dependencies installed successfully!")
    print("You can now test the auth system!")
else:
    print("\n❌ Some dependencies failed to install")
