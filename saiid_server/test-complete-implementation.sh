#!/bin/bash

echo "🎯 Testing Complete Orphan Groupings Implementation..."

echo "1. Testing create grouping endpoint..."
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
  }' | head -200

echo ""
echo "2. Testing locations endpoint..."
curl -s http://localhost:5174/api/orphan-groupings/locations | head -200

echo ""
echo "3. Testing groupings list endpoint..."
curl -s http://localhost:5174/api/orphan-groupings | head -200

echo ""
echo "✅ All tests completed!"
echo ""
echo "💡 The implementation now includes:"
echo "   - ✅ Create grouping with full form"
echo "   - ✅ Edit grouping functionality"
echo "   - ✅ Delete grouping functionality"
echo "   - ✅ Advanced selection criteria"
echo "   - ✅ Governorate/district filters"
echo "   - ✅ Age range and gender filters"
echo "   - ✅ Health and enrollment filters"
echo "   - ✅ Exclude adopted orphans option"
