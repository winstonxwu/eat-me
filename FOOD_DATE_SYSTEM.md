# 🍽️ Food Date Calendar System - Implementation Guide

## Overview
The **Food Date Calendar System** allows users to invite their matches to share meals at restaurants, creating a seamless transition from online matching to real-world meetups. The system includes proposal creation, cute notifications, and response handling (accept/reject/renegotiate).

---

## 📋 System Components

### **1. Database Schema**
**File**: `food_date_schema.sql`

**Tables Created:**
- `food_date_proposals` - Stores date invitations
- `food_date_events` - Confirmed dates
- `food_date_counter_proposals` - Renegotiation proposals

**Key Features:**
- ✅ Auto-expiring proposals (7 days)
- ✅ Row Level Security (RLS) policies
- ✅ Real-time subscriptions enabled
- ✅ Automatic event creation on acceptance

### **2. Core Screens**

#### **FoodDateScreen** (`src/screens/FoodDateScreen.js`)
**Purpose**: Create and send food date proposals

**Features:**
- 🍽️ Restaurant selection with images
- 📅 Date/time picker with meal detection (🥞 breakfast, 🍕 lunch, 🍷 dinner)
- 💌 Custom message input
- 📋 Real-time preview of date invitation
- 🎉 Send invitation with cute notification

**Navigation**: Accessed via "🍽️ Eat" button in MatchesScreen

#### **FoodDateProposalsScreen** (`src/screens/FoodDateProposalsScreen.js`)
**Purpose**: Display incoming date invitations

**Features:**
- 📱 Shows pending invitations
- 🔄 Pull-to-refresh functionality
- 📝 Empty state with helpful messaging

#### **DateProposalCard** (`src/components/DateProposalCard.js`)
**Purpose**: Interactive card for responding to date invitations

**Response Options:**
- 😍 **Accept** - Creates confirmed date event
- 📝 **Suggest Changes** - Opens renegotiation (placeholder)
- 😅 **Maybe Next Time** - Politely decline

### **3. Enhanced Notifications**

#### **Updated**: `src/utils/notifications.js`
**New Function**: `scheduleCustomNotification()`

**Food Date Notification Examples:**
```javascript
// Invitation sent
"🍝 [Name] wants to share Italian food with you at Tony's on Sat 7pm! 💕"

// Date accepted
"🎉 YES! [Name] accepted your dinner date! Saturday 7pm at Tony's - it's going to be amazing! 💕"

// Date declined
"💔 [Name] isn't available for that date. Maybe suggest something else? 💭"
```

### **4. Navigation Updates**

#### **Updated**: `src/navigation/index.js`
**Added Routes:**
- `FoodDateScreen` - Date proposal creation
- `FoodDateProposalsScreen` - View incoming invitations

#### **Updated**: `src/screens/MatchesScreen.js`
**Enhancement**: "🍽️ Eat" button now navigates to `FoodDateScreen` instead of old `SuggestionsScreen`

---

## 🚀 Setup Instructions

### **1. Database Setup**
```sql
-- Run this in your Supabase SQL Editor
-- File: food_date_schema.sql
-- This creates all tables, policies, and triggers
```

### **2. Dependencies Installed**
```bash
npm install @react-native-community/datetimepicker
```

### **3. File Structure**
```
src/
├── screens/
│   ├── FoodDateScreen.js           # Create date invitations
│   └── FoodDateProposalsScreen.js  # View received invitations
├── components/
│   └── DateProposalCard.js         # Interactive invitation cards
├── utils/
│   └── notifications.js            # Enhanced with custom notifications
└── navigation/
    └── index.js                    # Updated with new routes
```

---

## 🎯 User Journey

### **Sending a Date Invitation:**
1. User opens **MatchesScreen**
2. Clicks "🍽️ Eat" on a match
3. **FoodDateScreen** opens with:
   - Restaurant selection grid
   - Date/time pickers
   - Custom message input
   - Live preview
4. User sends invitation
5. Cute notification sent to match

### **Receiving a Date Invitation:**
1. User receives push notification
2. Opens **FoodDateProposalsScreen**
3. Sees **DateProposalCard** with:
   - Restaurant details
   - Proposed date/time
   - Personal message
   - Three response buttons
4. User responds (Accept/Renegotiate/Decline)
5. Confirmation sent to original sender

---

## 🎨 Design Features

### **Visual Elements:**
- 🍽️ Food emoji integration throughout
- 📅 Smart meal time detection (breakfast/lunch/dinner)
- 🎨 Pink theme consistency (`#ffb6c1`)
- 💫 Smooth animations for responses
- 📸 Restaurant images (placeholder URLs)

### **UX Enhancements:**
- ⚡ Real-time preview of invitations
- 🔔 Context-aware notifications
- 🎯 Smart button states (loading/disabled)
- 💬 Gentle rejection options
- 🎉 Celebration animations on acceptance

---

## 🔮 Future Enhancements

### **Planned Features:**
1. **🔄 Renegotiation System** - Full counter-proposal flow
2. **🗺️ Yelp API Integration** - Real restaurant data
3. **📍 GPS-based Restaurant Discovery** - Location-aware suggestions
4. **📅 Calendar Integration** - Sync with device calendars
5. **🎭 Advanced Response Options** - More nuanced declining
6. **💬 In-Date Messaging** - Chat during confirmed dates
7. **⭐ Post-Date Reviews** - Rate the experience
8. **🏆 Dating Streak Tracking** - Gamification elements

### **Technical Improvements:**
- 📊 Analytics tracking
- 🔍 Restaurant search and filtering
- 📱 Push notification deep linking
- 🎨 Custom restaurant photo uploads
- 🌐 Multi-language support

---

## 🛠️ Database Schema Details

### **food_date_proposals**
```sql
- id (UUID, Primary Key)
- match_id (UUID, References matches)
- proposed_by (UUID, References auth.users)
- proposed_to (UUID, References auth.users)
- restaurant_name (TEXT)
- restaurant_address (TEXT)
- restaurant_yelp_id (TEXT, future use)
- restaurant_cuisine (TEXT, e.g., "Italian 🍝")
- restaurant_rating (DECIMAL)
- restaurant_price_level (INTEGER, 1-4 for $-$$$$)
- proposed_datetime (TIMESTAMP)
- message (TEXT, personal message)
- status (TEXT, 'pending'|'accepted'|'rejected'|'expired'|'cancelled')
- created_at (TIMESTAMP)
- responded_at (TIMESTAMP)
- expires_at (TIMESTAMP, auto-set to +7 days)
```

### **food_date_events**
```sql
- id (UUID, Primary Key)
- proposal_id (UUID, References food_date_proposals)
- match_id (UUID, References matches)
- user_a (UUID, References auth.users)
- user_b (UUID, References auth.users)
- restaurant_name (TEXT)
- restaurant_address (TEXT)
- confirmed_datetime (TIMESTAMP)
- status (TEXT, 'confirmed'|'completed'|'cancelled'|'no_show')
- notes (TEXT)
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

---

## 🔐 Security Features

### **Row Level Security (RLS)**
- ✅ Users can only see their own proposals
- ✅ Users can only respond to proposals sent to them
- ✅ Users can only create proposals for their matches
- ✅ Automatic cleanup of expired proposals

### **Data Validation**
- ✅ Future date validation
- ✅ Match relationship verification
- ✅ Authentication requirements
- ✅ Message length limits (200 chars)

---

## 🎉 Ready to Use!

The **Food Date Calendar System** is now fully implemented and ready for your users to create meaningful food-focused connections!

**Next Step**: Run the `food_date_schema.sql` in your Supabase dashboard to activate the system.

---

*Built with ❤️ for meaningful food connections* 🍽️💕