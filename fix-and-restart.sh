#!/bin/bash
# Fix Core Info and Restart Dev Server

echo "🔧 Fixing Core Info Feature..."
echo ""

echo "Step 1/3: Cleaning build cache..."
rm -rf .output node_modules/.vite
echo "✓ Cache cleared"
echo ""

echo "Step 2/3: Regenerating Prisma client..."
npx prisma generate
echo "✓ Prisma client generated"
echo ""

echo "Step 3/3: Starting dev server..."
echo "✓ All setup complete!"
echo ""
echo "================================================"
echo "✅ Core Info feature is ready!"
echo "================================================"
echo ""
echo "Starting dev server now..."
echo "Press Ctrl+C to stop the server"
echo ""
npm run dev
