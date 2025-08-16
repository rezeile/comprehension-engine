#!/usr/bin/env python3
"""
Script to install missing dependencies
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

# Install the database dependencies we added
packages = [
    "sqlalchemy==2.0.23",
    "psycopg2-binary==2.9.7", 
    "alembic==1.12.1"
]

print("Installing database dependencies...")
all_success = True

for package in packages:
    success = install_package(package)
    all_success = all_success and success

if all_success:
    print("\n🎉 All dependencies installed successfully!")
    print("You can now run: python test_imports.py")
else:
    print("\n❌ Some dependencies failed to install")
