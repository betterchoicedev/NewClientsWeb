## 1. Phone Verification for Registration
- **Files**: `src/pages/SignupPage.jsx`, `src/supabase/auth.js`, `supabase` auth configuration
- **Issue**: Enable phone verification during user registration to ensure valid contact information and improve account security
- **Status**: Pending
- **Use Case**:
  - User signs up via web form
  - System sends verification code to provided phone number
  - User enters code to complete registration
  - Prevents fake or incorrect phone numbers from being saved
- **Implementation**:
  - Configure Supabase (or preferred provider) for SMS-based OTP verification
  - Update signup form to collect phone number in E.164 format
  - Add UI flow for sending and verifying OTP codes
  - Prevent account creation until phone number is verified
  - Store verification status in user profile (e.g., `phone_verified` flag)
  - Handle resending codes and rate limiting
  - Provide clear error handling and messaging for failed verifications
  - Ensure accessibility and responsive design of verification steps
  - Write tests or QA plan covering successful verification and error cases
  - Document verification flow for support and operations teams

---

# 📋 Dietitian Website - Client App Integration Tasks

## 🎯 Database Columns Added (Already in Supabase)

### `clients` table:
- ✅ `show_calories` (BOOLEAN, default: true)
- ✅ `show_macros` (BOOLEAN, default: true)
- ✅ `portion_display` (TEXT, default: 'both') - Options: 'grams', 'household', 'both'
- ✅ `measurement_system` (TEXT, default: 'metric') - Options: 'metric', 'imperial'
- ✅ `weight_unit` (TEXT, default: 'grams') - Options: 'grams', 'ounces'
- ✅ `decimal_places` (INTEGER, default: 1) - Options: 0, 1, 2
- ✅ `user_language` (TEXT, default: 'hebrew') - Options: 'hebrew', 'english'

### `client_meal_plans` table:
- ✅ `edited_plan_date` (TIMESTAMP) - Tracks when client edited their meal plan
- ✅ `client_edited_meal_plan` (JSONB) - Contains client's modified version of the meal plan

### `ingridientsroee` table (New Ingredient Database):
- ✅ Already exists in Supabase
- Used by clients to search and add ingredients to their meal plans

---

## 🛠️ Required Tasks for Dietitian Website

### **1. Client Display Preferences UI** (Priority: Medium)
**Where:** Client profile page / Settings section

Add a section to view/edit client preferences:
```
Display Preferences:
☑ Show Calories: [Toggle]
☑ Show Macros: [Toggle]
📏 Portion Display: [Grams | Household | Both]
⚖️ Measurement System: [Metric | Imperial]
🔢 Weight Unit: [Grams | Ounces]
🔢 Decimal Places: [0 | 1 | 2]
🌍 Language: [Hebrew | English]
```

**Why:** Dietitians can see how clients view their data and help them adjust settings if needed.

---

### **2. Client Edited Meal Plans Indicator** (Priority: High)
**Where:** Meal plans list / Client dashboard

Add visual indicator when viewing a client's meal plan:
```
Original Plan: ✅ [View JSON]
Client Edited: ⚠️ [View JSON] - Last edited: Nov 27, 2025 at 14:30
```

**Why:** Dietitians need to know if the client has modified their meal plan today.

---

### **3. Compare Original vs Edited Plans** (Priority: High)
**Where:** Meal plan view page

Add a "Compare Changes" button that shows:
```
Side-by-side comparison:
[Original Plan]  vs  [Client's Edited Version]

Changes:
✅ Breakfast - Added: Banana (120g)
✅ Lunch - Removed: White Rice (150g)
✅ Lunch - Changed: Chicken Breast (150g → 200g)
⚠️ Total Calories: 2800 → 3109 (+309)
⚠️ Total Protein: 200g → 242.1g (+42.1g)
```

**Why:** Helps dietitians understand what changes clients are making and adjust future plans accordingly.

---

### **4. Ingredient Search & Management** (Priority: High)
**Where:** Meal plan builder / Ingredient management

Add features for `ingridientsroee` table:

**A. Browse/Search Ingredients:**
```
Search ingredients used by clients:
- Filter by: name, english_name, barcode
- Show: calories_100g, protein_100g, carbs_100g, fat_100g
- Sort by: most used, recently added
```

**B. Add/Edit Ingredients:**
```
When creating meal plans, use same ingredient database:
- Search from ingridientsroee table
- See what ingredients clients can access
- Add new ingredients that clients can search for
```

**C. Ingredient Analytics:**
```
View which ingredients clients are adding:
- Most commonly added ingredients
- Ingredients frequently removed
- Popular swaps/substitutions
```

**Why:** 
- Ensures consistency between what dietitians plan and what clients can add
- Helps understand client preferences and behavior
- Informs future meal plan creation

---

### **5. Meal Plan JSON Structure Update** (Priority: High)
**Where:** Meal plan creation/editing

Update meal plan JSON structure to support client edits:

**Current Structure:**
```json
{
  "meals": [
    {
      "meal": "Breakfast",
      "main": {
        "meal_title": "Protein Oatmeal",
        "nutrition": { "calories": 450, "protein": 30, "carbs": 50, "fat": 15 },
        "ingredients": [
          {
            "item": "Oats",
            "portionSI(gram)": 50,
            "household_measure": "1/2 cup",
            "calories": 195,
            "protein": 6.5,
            "carbs": 33.8,
            "fat": 3.5,
            "UPC": null,
            "brand of pruduct": ""
          }
        ]
      }
    }
  ],
  "totals": { "calories": 3109, "protein": 242.1, "carbs": 312.5, "fat": 109 }
}
```

**Key Notes:**
- `ingredients` array is editable by clients
- Clients can add from `ingridientsroee` table
- `UPC` and `brand of pruduct` fields exist but are null for now
- Nutrition recalculates automatically when ingredients change

**Why:** Dietitians need to create meal plans with proper structure for client editing.

---

### **6. Reset Client's Edited Plan** (Priority: Low)
**Where:** Meal plan actions

Add a button/action:
```
"Clear Client Edits" → Sets:
  - client_edited_meal_plan = NULL
  - edited_plan_date = NULL
```

**Why:** Allows dietitians to reset a client to the original plan if needed.

---

### **7. Auto-Set Preferences on Client Creation** (Priority: High)
**Where:** New client form / Client onboarding

When creating a new client, automatically set based on region:
```javascript
// Based on region/phone code
if (client.phone.startsWith('+1')) {
  measurement_system = 'imperial';
  weight_unit = 'ounces';
} else {
  measurement_system = 'metric';
  weight_unit = 'grams';
}

// Default other preferences
show_calories = true;
show_macros = true;
portion_display = 'both';
decimal_places = 1;
```

**Why:** Ensures new clients have appropriate defaults based on their location.

---

### **8. Display Preferences in Client List** (Priority: Low)
**Where:** Clients table/list view

Add small badges next to client names:
```
John Doe 🇺🇸 [Imperial] [oz] [Both] [1 decimal]
Sarah Cohen 🇮🇱 [Metric] [g] [Both] [1 decimal]
```

**Why:** Quick visual reference of client preferences.

---

### **9. Ingredient Database Management** (Priority: Medium)
**Where:** Admin panel / Ingredient management

Create an interface for managing `ingridientsroee`:

**Features:**
```
A. Add New Ingredients:
   - Name (Hebrew)
   - English name
   - Nutrition per 100g (calories, protein, carbs, fat)
   - Barcode (optional)
   - Brand (optional)

B. Edit Existing Ingredients:
   - Update nutrition values
   - Fix typos in names
   - Add missing translations

C. Bulk Import:
   - CSV upload for adding multiple ingredients
   - Required columns: name, english_name, calories_100g, protein_100g, carbs_100g, fat_100g

D. View Usage Statistics:
   - How many times each ingredient has been added by clients
   - Most popular ingredients
   - Unused ingredients (candidates for removal)
```

**Why:** Keeps the ingredient database clean, accurate, and useful for clients.

---

### **10. Daily Plan Resets Notification** (Priority: Low)
**Where:** Client activity dashboard

Show when clients' edited plans expire:
```
📅 Daily Plan Status:
- Client A: Edited plan from today (active) ✅
- Client B: Edited plan from yesterday (expired) ⚠️
- Client C: No edits (using original plan) ℹ️
```

**Why:** Helps dietitians understand that client edits are day-specific and reset daily.

---

## 📊 SQL Queries for Dietitian Website

### View all clients with custom preferences:
```sql
SELECT 
  full_name,
  user_language,
  measurement_system,
  weight_unit,
  portion_display,
  show_calories,
  show_macros,
  decimal_places
FROM clients
WHERE measurement_system = 'imperial' 
   OR weight_unit = 'ounces'
   OR portion_display != 'both'
ORDER BY full_name;
```

### Find clients who edited their meal plan today:
```sql
SELECT 
  c.full_name,
  c.user_code,
  cmp.meal_plan_name,
  cmp.edited_plan_date,
  cmp.client_edited_meal_plan IS NOT NULL as has_edits,
  jsonb_array_length(cmp.client_edited_meal_plan->'meals') as num_meals
FROM clients c
JOIN client_meal_plans cmp ON c.user_code = cmp.user_code
WHERE DATE(cmp.edited_plan_date) = CURRENT_DATE
  AND cmp.client_edited_meal_plan IS NOT NULL
ORDER BY cmp.edited_plan_date DESC;
```

### Most popular ingredients added by clients:
```sql
-- This query extracts ingredients from client_edited_meal_plan JSON
SELECT 
  ingredient->>'item' as ingredient_name,
  COUNT(*) as usage_count,
  AVG((ingredient->>'portionSI(gram)')::numeric) as avg_portion_grams
FROM client_meal_plans,
  jsonb_array_elements(client_edited_meal_plan->'meals') as meal,
  jsonb_array_elements(meal->'main'->'ingredients') as ingredient
WHERE client_edited_meal_plan IS NOT NULL
GROUP BY ingredient->>'item'
ORDER BY usage_count DESC
LIMIT 20;
```

### Clear old edited plans (run daily as cleanup):
```sql
-- Clear edited plans older than today
UPDATE client_meal_plans
SET 
  client_edited_meal_plan = NULL,
  edited_plan_date = NULL
WHERE DATE(edited_plan_date) < CURRENT_DATE
  AND client_edited_meal_plan IS NOT NULL;
```

---

## ⏱️ Time Estimates

| Task | Priority | Time Estimate |
|------|----------|---------------|
| 1. Display Preferences UI | Medium | 2-3 hours |
| 2. Edited Plan Indicator | High | 1 hour |
| 3. Compare Plans | High | 4-5 hours |
| 4. Reset Button | Low | 30 mins |
| 5. Auto-set Preferences | High | 1 hour |
| 6. Client List Badges | Low | 1-2 hours |
| 7. Ingredient DB Management | Medium | 6-8 hours |
| 8. Daily Reset Notification | Low | 2 hours |

**Total High Priority:** ~6-7 hours  
**Total All Tasks:** ~18-23 hours

---

## 🚀 Recommended Implementation Order

### Phase 1 (Essential - Week 1):
1. ✅ **Task 5** - Auto-set preferences on new clients
2. ✅ **Task 2** - Show edited plan indicator  
3. ✅ **Task 9** - Basic ingredient management interface

### Phase 2 (Important - Week 2):
4. ✅ **Task 1** - Display preferences UI
5. ✅ **Task 3** - Compare original vs edited plans

### Phase 3 (Nice-to-have - Week 3):
6. ✅ **Task 6** - Client list badges
7. ✅ **Task 4** - Reset button
8. ✅ **Task 10** - Daily reset notifications

---

## 📝 Important Notes

### Ingredient Addition Flow (Client Side):
1. Client opens meal plan
2. Expands a meal → clicks **+** button
3. **Search Modal** opens:
   - Searches `ingridientsroee` table
   - Filters by `name` (Hebrew) and `english_name`
   - Shows results with nutrition per 100g
4. Client selects ingredient
5. **Portion Modal** opens:
   - Client enters grams OR household measure
   - AI converts between units if needed
   - Nutrition auto-calculates based on portion
6. Client clicks "Add to Meal"
7. Ingredient added to `client_edited_meal_plan` JSON
8. `edited_plan_date` set to current timestamp

### What Dietitians Should See:
- **Which ingredients** clients are adding/removing
- **How much** they're eating (portions)
- **When** they made changes (timestamp)
- **Nutrition impact** (before/after totals)

This helps dietitians:
- Understand client preferences
- Adjust future meal plans
- Identify patterns (e.g., always removes dairy, adds more protein)
- Provide better guidance
