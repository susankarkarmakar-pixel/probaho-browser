#!/bin/bash

# Probaho Browser Build Script
# Built by Susankar Karmakar

echo "=========================================="
echo "  Probaho Browser Build Script v1.0"
echo "  Built by Susankar Karmakar"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    echo "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi

print_success "Node.js version: $(node -v)"

# Navigate to the app directory
cd "$(dirname "$0")/app" || exit 1

# Install dependencies
print_status "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies!"
    exit 1
fi
print_success "Dependencies installed successfully!"

# Build React app
print_status "Building React app..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Failed to build React app!"
    exit 1
fi
print_success "React app built successfully!"

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="win"
fi

print_status "Detected OS: $OS"

# Build for detected platform
case $OS in
    linux)
        print_status "Building for Linux..."
        npm run dist:linux
        ;;
    mac)
        print_status "Building for macOS..."
        npm run dist:mac
        ;;
    win)
        print_status "Building for Windows..."
        npm run dist:win
        ;;
    *)
        print_warning "Unknown OS. Building for all platforms..."
        npm run dist
        ;;
esac

if [ $? -ne 0 ]; then
    print_error "Build failed!"
    print_status "Trying alternative build method..."
    
    # Try using npx directly
    npx electron-builder
    
    if [ $? -ne 0 ]; then
        print_error "Alternative build also failed!"
        print_status "You can try running the browser in development mode:"
        print_status "  cd app && npm run electron"
        exit 1
    fi
fi

print_success "Build completed successfully!"
echo ""
echo "=========================================="
echo "  Build Output Location:"
echo "  $(pwd)/release/"
echo "=========================================="
echo ""

# List built files
if [ -d "release" ]; then
    print_status "Built files:"
    ls -lh release/
fi

echo ""
print_success "Probaho Browser has been built successfully!"
echo ""
echo "To run the browser:"
echo "  - Windows: Run release/Probaho Browser.exe"
echo "  - macOS: Open release/Probaho Browser.dmg"
echo "  - Linux: Run release/*.AppImage"
echo ""
echo "Thank you for using Probaho Browser!"
echo "Built by Susankar Karmakar"
