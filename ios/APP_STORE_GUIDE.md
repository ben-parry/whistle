# Whistle iOS App — App Store Submission Guide

A step-by-step guide to getting the Whistle iOS app published on the Apple App Store.

## Prerequisites

- A Mac with Xcode 15+ installed
- An Apple ID
- An Apple Developer Program membership ($99 USD/year)
- The Whistle Xcode project (`ios/Whistle/Whistle.xcodeproj`)
- A 1024x1024 app icon image (PNG, no transparency, no rounded corners — Apple rounds them automatically)

## Step 1: Enroll in the Apple Developer Program

1. Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/)
2. Sign in with your Apple ID (or create one)
3. Follow the enrollment steps — you'll need to verify your identity
4. Pay the $99 USD annual fee
5. Wait for approval (usually 24–48 hours, sometimes instant)

## Step 2: Open the Project in Xcode

1. Open `ios/Whistle/Whistle.xcodeproj` in Xcode
2. In the project navigator, select the **Whistle** project (blue icon at the top)
3. Select the **Whistle** target

## Step 3: Configure Signing

1. In the **Signing & Capabilities** tab:
   - Check **Automatically manage signing**
   - Select your **Team** (your Apple Developer account)
   - Xcode will automatically create a provisioning profile and signing certificate
2. If you see a "No accounts" error:
   - Go to **Xcode → Settings → Accounts**
   - Click **+** and sign in with your Apple Developer account

## Step 4: Set the Bundle Identifier

1. In the **General** tab, set **Bundle Identifier** to something unique:
   - Format: `ca.benparry.whistle` (or your own domain reversed)
   - This must be globally unique across all apps on the App Store
2. Set **Display Name** to `Whistle`
3. Set **Version** to `1.0` and **Build** to `1`

## Step 5: Update the API Base URL

1. Open `Whistle/Models/APIConfig.swift`
2. Change `baseURL` to your production Vercel URL:
   ```swift
   static let baseURL = "https://your-whistle-domain.vercel.app"
   ```

## Step 6: Add the App Icon

1. In the project navigator, open `Assets.xcassets → AppIcon`
2. Drag your 1024x1024 PNG icon into the "All Sizes" slot
3. Tips for the icon:
   - Use the Whistle color scheme (#332F35 background, #F0EAD9 text/elements)
   - A simple "W" in Playfair Display works well
   - No transparency allowed
   - Apple automatically applies corner rounding

## Step 7: Test on a Real Device

Before submitting, test on a physical iPhone:

1. Connect your iPhone via USB
2. On your iPhone: **Settings → Privacy & Security → Developer Mode** → Enable
3. Trust your computer when prompted
4. In Xcode, select your iPhone from the device dropdown (top of Xcode)
5. Click **Run** (▶️)
6. On first run, go to **Settings → General → VPN & Device Management** on your iPhone and trust your developer certificate

Test thoroughly:
- Login works
- Clock in/out works
- Time restrictions display correctly
- Sunday message appears on Sundays
- The "visit website" link opens correctly
- Sign out works
- Session persists after closing and reopening the app

## Step 8: Create an App Store Connect Record

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Whistle
   - **Primary Language**: English (US)
   - **Bundle ID**: Select the one matching your Xcode project
   - **SKU**: `whistle-ios` (any unique string)
   - **User Access**: Full Access

## Step 9: Fill in App Store Listing

In App Store Connect, fill in the required metadata:

### App Information
- **Subtitle**: "Your Personal Punch Clock" (max 30 chars)
- **Category**: Productivity
- **Secondary Category**: Business

### Pricing and Availability
- **Price**: Free
- **Availability**: All territories (or select specific ones)

### Version Information
- **Description** (example):
  ```
  Whistle is a beautifully simple punch clock. Clock in when you start working,
  clock out when you stop. That's it.

  Features:
  • One-tap clock in/out
  • Live elapsed time display
  • Smart boundaries — work happens between 5 AM and 9 PM
  • Sundays are for rest

  For full features including stats, heatmaps, leaderboards, and session history,
  visit Whistle on the web.

  Note: Requires an existing Whistle account. Create one at the Whistle website.
  ```

- **Keywords**: time tracking, punch clock, work hours, clock in, productivity
- **Support URL**: Your website or GitHub repo URL
- **Marketing URL**: (optional) Your Whistle web app URL

### Screenshots
You need screenshots for:
- **6.7" display** (iPhone 15 Pro Max): At least 1, up to 10
- **6.5" display** (iPhone 11 Pro Max): At least 1, up to 10

To take screenshots:
1. Run the app in Xcode Simulator
2. Select the correct simulator device size
3. Press **Cmd+S** in the simulator to save a screenshot
4. Take screenshots of: Login screen, Clock In state, Currently Working state

### App Review Information
- **Contact Information**: Your name, phone, email
- **Notes for Review**:
  ```
  This app is a companion to the Whistle web app. Account creation is done
  on the website. To test, please use these credentials:
  Email: [provide a test account email]
  Password: [provide a test account password]
  ```
  **Important**: Create a dedicated test account for Apple's review team

### Age Rating
- Select "None" for all content descriptors (the app has no objectionable content)
- This will give you a 4+ rating

## Step 10: Create an Archive and Upload

1. In Xcode, select **Any iOS Device (arm64)** as the build target (not a simulator)
2. Go to **Product → Archive**
3. Wait for the build to complete
4. The **Organizer** window will open with your archive
5. Click **Distribute App**
6. Select **App Store Connect** → **Upload**
7. Follow the prompts (accept defaults)
8. Wait for the upload to complete

## Step 11: Submit for Review

1. Back in App Store Connect, your uploaded build should appear under **Build** (may take 5–15 minutes to process)
2. Select the build
3. Fill in any remaining required fields (App Store Connect will highlight missing items in red)
4. Click **Add for Review**
5. Click **Submit to App Review**

## Step 12: Wait for Review

- **Typical review time**: 24–48 hours (sometimes same day, sometimes up to a week)
- You'll receive email notifications about the review status
- Common rejection reasons and fixes:
  - **"Login required but no way to create account"**: Make sure the "Create one at whistle on the web" link is prominent
  - **"Incomplete metadata"**: Fill in all required fields including screenshots
  - **"App doesn't do enough"**: Emphasize in the review notes that this is a companion app to a web service
  - **"Guideline 4.2 - Minimum Functionality"**: If rejected for this, add a brief description in review notes explaining the web app integration

## Step 13: Release

Once approved:
- If you selected **Manually release**, go to App Store Connect and click **Release This Version**
- If you selected **Automatically release**, it goes live as soon as it's approved

## Updating the App Later

1. Increment the **Build** number in Xcode (e.g., 1 → 2)
2. Optionally increment the **Version** (e.g., 1.0 → 1.1)
3. Archive and upload again
4. In App Store Connect, create a new version and select the new build
5. Submit for review

## Troubleshooting

### "No signing certificate found"
- Go to Xcode → Settings → Accounts → your account → Manage Certificates
- Click + to create a new Apple Distribution certificate

### Build fails with "Provisioning profile" error
- Make sure "Automatically manage signing" is checked
- Make sure your Apple Developer membership is active

### Upload fails
- Check your internet connection
- Make sure you're signed in to the correct Apple Developer account in Xcode
- Try Product → Clean Build Folder, then Archive again

### "This bundle is invalid" error
- Make sure the Bundle ID matches what you registered in App Store Connect
- Make sure you have a valid app icon (1024x1024, no alpha channel)
