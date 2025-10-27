# Microphone Permission Fix Guide

## Problem
If you accidentally denied microphone access, the browser will remember that decision and block NoCap from accessing your microphone.

## Solution - I've Added Helpful Features!

Your NoCap application now has **automatic permission detection and helpful error messages**!

### What's New

1. **Automatic Permission Detection** - The app now checks your microphone permission status automatically
2. **Helpful Error Messages** - If permissions are denied, you'll see clear instructions on how to fix it
3. **Visual Indicators** - The voice input button shows an error state when permissions are blocked
4. **Step-by-Step Instructions** - The app displays exactly how to re-enable microphone access

## How to Fix Denied Permissions

### Option 1: Using the App's Built-in Guide (Easiest!)
1. Open NoCap in your browser
2. You'll see a **red alert box** with step-by-step instructions
3. Follow the instructions shown in the alert
4. Click "Check Again" once you've made the changes

### Option 2: Manual Browser Settings

#### Chrome/Edge/Brave
1. Click the **lock icon** 🔒 or **site info icon** in the address bar (left side)
2. Find **"Microphone"** in the permissions list
3. Change it from "Block" to **"Allow"**
4. Refresh the page (or click "Check Again" in the app)

#### Firefox
1. Click the **lock icon** 🔒 in the address bar
2. Click **"Connection secure"** or **"More information"**
3. Click **"More Information"** > **"Permissions"** tab
4. Find **"Use the Microphone"** and click **"Allow"**
5. Refresh the page

#### Safari
1. Go to **Safari menu** > **Settings** > **Websites** > **Microphone**
2. Find your NoCap site in the list
3. Change the permission to **"Allow"**
4. Refresh the page

## Features I Added

### 1. Permission Status Checker (`src/services/voice-service.ts`)
- `checkMicrophonePermission()` - Checks current permission status
- `requestMicrophonePermission()` - Explicitly requests permission
- Better error handling with detailed permission status

### 2. Permission Alert Component (`src/components/MicrophonePermissionAlert.tsx`)
Shows different alerts based on permission status:
- ✅ **Granted** - Green success message
- ❌ **Denied** - Red alert with step-by-step fix instructions
- 🔵 **Prompt** - Blue alert with "Allow Microphone" button

### 3. Enhanced Voice Button (`src/components/VoiceInputButton.tsx`)
- Shows error icon when permissions are blocked
- Disables the button until permissions are fixed
- Displays helpful error messages

### 4. Main App Integration (`src/routes/index.tsx`)
- Tracks permission status throughout the session
- Shows the permission alert automatically when needed
- Clears errors once permissions are granted

## Testing the Fix

1. Open NoCap in your browser
2. If you see the permission alert, follow the instructions
3. Click "Check Again" after fixing permissions
4. The alert should turn green ✅
5. Click "Start Session" to begin using voice input

## What Happens Now?

When you try to start a session:
1. The app checks if you have microphone permission
2. If denied, it shows a **helpful error message** with fix instructions
3. You can click **"Check Again"** after fixing permissions
4. Once fixed, the error disappears and you can use voice input!

## Need More Help?

If you're still having issues:
1. Try opening NoCap in a **different browser**
2. Check your **system microphone settings** (OS level)
3. Make sure no other app is using your microphone
4. Look in the browser console for specific error messages

---

All TypeScript checks pass ✅ - Your app is ready to use!
