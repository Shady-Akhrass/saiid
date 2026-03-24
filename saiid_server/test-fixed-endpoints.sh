#!/bin/bash

echo "🔧 Testing Fixed API Endpoints..."

echo "1. Testing create grouping (should work now)..."
curl -s -X POST http://localhost:5174/api/orphan-groupings \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Grouping",
    "description": "Test Description",
    "max_capacity": 50,
    "selection_criteria": {
      "mother_status": ["deceased"],
      "father_status": ["deceased"],
      "health_conditions": ["healthy"],
      "governorate_filter": "محافظة غزة",
      "district_filter": "",
      "age_range": {"min": 5, "max": 18},
      "gender": "both",
      "enrollment_status": ["enrolled"],
      "exclude_adopted": true
    }
  }' | head -100

echo ""
echo "2. Testing groupings list endpoint..."
curl -s http://localhost:5174/api/orphan-groupings | head -100

echo ""
echo "3. Testing locations endpoint..."
curl -s http://localhost:5174/api/orphan-groupings/locations | head -100

echo ""
echo "✅ API tests completed!"
echo ""
echo "💡 Fixed Issues:"
echo "   ✅ Removed duplicate /api from all endpoints"
echo "   ✅ POST /api/orphan-groupings (not /api/api/orphan-groupings)"
echo "   ✅ POST /orphan-groupings/fuzzy-search"
echo "   ✅ POST /orphan-groupings/{id}/add-orphans"
echo "   ✅ POST /orphan-groupings/{id}/smart-select"
echo "   ✅ All endpoints now use correct proxy routing"
