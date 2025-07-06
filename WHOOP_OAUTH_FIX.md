# WHOOP OAuth Redirect URI Fix

## Issue
WHOOP OAuth is failing because the redirect URI is set to `https://biodrive.app/api/auth/whoop/callback` but the SSL certificate for biodrive.app is not working yet.

## Current Working Domain
Your Replit app is accessible at: `https://a617aa60-beeb-43c6-b4d3-752bf9a9fcae-00-3f1jnhogfceh.spock.replit.dev`

## Fix Required

### Step 1: Update Replit Secret
1. Go to your Replit project's **Secrets** tab (in the left sidebar)
2. Find the `WHOOP_REDIRECT_URI` secret
3. Update it from:
   ```
   https://biodrive.app/api/auth/whoop/callback
   ```
   to:
   ```
   https://a617aa60-beeb-43c6-b4d3-752bf9a9fcae-00-3f1jnhogfceh.spock.replit.dev/api/auth/whoop/callback
   ```

### Step 2: Update WHOOP Developer Console
1. Go to [WHOOP Developer Console](https://developer.whoop.com/)
2. Sign in to your developer account
3. Navigate to your OAuth application settings
4. Update the "Redirect URI" field to match the new Replit domain:
   ```
   https://a617aa60-beeb-43c6-b4d3-752bf9a9fcae-00-3f1jnhogfceh.spock.replit.dev/api/auth/whoop/callback
   ```

### Step 3: Test WHOOP Connection
After updating both the secret and the developer console:
1. Restart the application (workflow will auto-restart)
2. Go to the Wearable Devices section on your dashboard
3. Click "Connect WHOOP"
4. You should now be redirected properly to WHOOP's OAuth flow

## Future: When biodrive.app SSL is Fixed
Once Replit support resolves the SSL certificate issue for biodrive.app, you can:
1. Update the redirect URI back to `https://biodrive.app/api/auth/whoop/callback`
2. Update the WHOOP Developer Console to use the custom domain
3. This will provide a more professional OAuth experience

## Current Status
- ✅ WHOOP OAuth strategy is properly configured
- ✅ All API endpoints are working
- ❌ Redirect URI mismatch (easily fixable with the steps above)
- ❌ Custom domain SSL certificate pending Replit support