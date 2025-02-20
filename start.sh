#!/bin/bash

echo "🚀 Starting deployment process..."

# Navigate to parent directory
cd ..

# Remove existing directory if it exists
echo "🗑️  Removing existing directory..."
if [ -d "Shedify" ]; then
    sudo rm -rf Shedify
fi

# Clone the repository
echo "📥 Cloning repository..."
git clone git@github.com:BorislavSergev/Shedify.git

# Navigate into project directory
echo "📂 Entering project directory..."
cd Shedify

# Install dependencies
echo "📦 Installing dependencies..."
npm i

# Build the project
echo "🛠️  Building project..."
npm run build

# Serve the built project
echo "🌐 Starting server..."
serve -s dist -l 4173

echo "✨ Deployment complete! Server running on port 4173" 