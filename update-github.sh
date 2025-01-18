#!/bin/bash

# Add all changes to staging
git add .

# Get the commit message from the user
read -p "Enter a commit message: " message

# Commit with the provided message
git commit -m "$message"

# Push to GitHub
git push

echo "Changes pushed to GitHub successfully!"
