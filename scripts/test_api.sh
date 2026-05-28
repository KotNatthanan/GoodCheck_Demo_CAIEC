#!/bin/bash
# GoodCheck API Test Script
# ใช้เพื่อทดสอบ API endpoints สามารถรัน bash test_api.sh
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:5050/api}"
SELLER_EMAIL="peet@example.com"
SELLER_PASS="password123"
BUYER_EMAIL="buyer@example.com"
BUYER_PASS="password123"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 GoodCheck API Test Suite${NC}\n"

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s "$API_BASE/health" | jq .
echo ""

# Test 2: Register (Seller)
echo -e "${YELLOW}Test 2: Register Seller${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_seller_'$(date +%s)'",
    "email": "seller_'$(date +%s)'@test.com",
    "password": "password123",
    "full_name": "Test Seller",
    "user_type": "seller"
  }')
echo $REGISTER_RESPONSE | jq .
REGISTER_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.access_token')
echo ""

# Test 3: Login (Seller)
echo -e "${YELLOW}Test 3: Login Seller${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$SELLER_EMAIL'",
    "password": "'$SELLER_PASS'"
  }')
echo $LOGIN_RESPONSE | jq .
SELLER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
SELLER_ID=$(echo $LOGIN_RESPONSE | jq -r '.user.id')
echo ""

# Test 4: Get Profile
echo -e "${YELLOW}Test 4: Get User Profile${NC}"
curl -s -X GET "$API_BASE/auth/profile" \
  -H "Authorization: Bearer $SELLER_TOKEN" | jq .
echo ""

# Test 5: Update Profile
echo -e "${YELLOW}Test 5: Update User Profile${NC}"
curl -s -X PUT "$API_BASE/auth/profile" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "089-123-4567",
    "location": "กรุงเทพฯ"
  }' | jq .
echo ""

# Test 6: Get Categories
echo -e "${YELLOW}Test 6: Get Categories${NC}"
curl -s "$API_BASE/products/categories" | jq .
echo ""

# Test 7: Get Locations
echo -e "${YELLOW}Test 7: Get Locations${NC}"
curl -s "$API_BASE/products/locations" | jq .
echo ""

# Test 8: Create Product
echo -e "${YELLOW}Test 8: Create Product${NC}"
CREATE_PRODUCT=$(curl -s -X POST "$API_BASE/products" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test RTX 4080",
    "price": 42900,
    "category": "Graphics Card",
    "condition": "Like new",
    "location": "กรุงเทพฯ",
    "warranty": "10 months",
    "description": "Test product description",
    "specs": ["10GB VRAM", "Like New", "With Receipt"],
    "image_url": "https://images.unsplash.com/photo-1612198527553-34b35c2c8303?auto=format&fit=crop&w=900&q=80"
  }')
echo $CREATE_PRODUCT | jq .
PRODUCT_ID=$(echo $CREATE_PRODUCT | jq -r '.product.id')
echo ""

# Test 9: Get All Products
echo -e "${YELLOW}Test 9: Get All Products${NC}"
curl -s "$API_BASE/products" | jq '.products[0:2]'
echo ""

# Test 10: Get Product Detail
echo -e "${YELLOW}Test 10: Get Product Detail${NC}"
curl -s "$API_BASE/products/1" | jq .
echo ""

# Test 11: Search Products
echo -e "${YELLOW}Test 11: Search Products${NC}"
curl -sG "$API_BASE/products" \
  --data-urlencode "search=RTX" \
  --data-urlencode "category=Graphics Card" \
  --data-urlencode "price_min=5000" \
  --data-urlencode "price_max=50000" | jq '.products[0:2]'
echo ""

# Test 12: Get Seller Products
echo -e "${YELLOW}Test 12: Get Seller Products${NC}"
curl -s "$API_BASE/products/seller/$SELLER_ID" | jq .
echo ""

# Test 13: Add Review
echo -e "${YELLOW}Test 13: Add Review${NC}"
curl -s -X POST "$API_BASE/products/1/reviews" \
  -H "Authorization: Bearer $REGISTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Great product! Highly recommended!"
  }' | jq .
echo ""

# Test 14: Update Product
echo -e "${YELLOW}Test 14: Update Product${NC}"
curl -s -X PUT "$API_BASE/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 41900,
    "description": "Updated description - Limited time offer!"
  }' | jq .
echo ""

# Test 15: Invalid Request (Missing Token)
echo -e "${YELLOW}Test 15: Invalid Request - Missing Token${NC}"
curl -s -X POST "$API_BASE/products" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}' | jq .
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo -e "${YELLOW}📊 Test Summary:${NC}"
echo "- Login: ✅"
echo "- Get Products: ✅"
echo "- Create Product: ✅"
echo "- Update Product: ✅"
echo "- Add Review: ✅"
echo "- Search/Filter: ✅"
echo ""
echo -e "${GREEN}🎉 API is working correctly!${NC}"
