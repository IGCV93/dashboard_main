#!/bin/bash
echo "Building static site..."
echo "Copying all HTML files to root..."
cp *.html ./ 2>/dev/null || true
cp public/*.html ./ 2>/dev/null || true
echo "Build complete!"
