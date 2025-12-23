# Meta Cloud API Setup Guide

Complete instructions for setting up WhatsApp Business API with Meta Cloud.

## Prerequisites

- Facebook Business Manager account
- A phone number for WhatsApp Business (not currently on WhatsApp)
- Government-issued ID for verification

## Step-by-Step Setup

### 1. Create Meta Business Account

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Click "Create Account"
3. Follow the prompts to set up your business

### 2. Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Business" as the app type
4. Fill in:
   - **App Name:** WhatsApp Crypto Wallet (or your choice)
   - **App Contact Email:** Your email
   - **Business Account:** Select your business
5. Click "Create App"

### 3. Add WhatsApp Product

1. In your app dashboard, find "Add Product"
2. Find "WhatsApp" and click "Set Up"
3. Select your Business Account
4. You'll be taken to WhatsApp setup page

### 4. Get Test Credentials (For Development)

Perfect for testing before going live!

1. In WhatsApp → Getting Started → API Setup
2. You'll see:
   - **Test Phone Number:** Pre-configured number you can use immediately
   - **Phone Number ID:** Copy this
   - **Temporary Access Token:** Copy this (valid 24 hours)
3. Under "To:", add your personal WhatsApp number
4. Send a test message to verify it works

### 5. Configure Webhook

Your webhook is hosted on Supabase Edge Functions (no ngrok needed!):

**Webhook URL:** `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`

1. In WhatsApp → Configuration
2. Click "Edit" next to Webhook
3. Enter:
   - **Callback URL:** `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token:** Your `META_WEBHOOK_VERIFY_TOKEN` from `.env`
4. Click "Verify and Save"
5. Subscribe to these webhook fields:
   - ✅ messages

The edge function is already deployed and running!

### 6. Update .env File

Add your credentials to `.env`:

\`\`\`env
# Test Credentials (24 hour token)
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
META_PHONE_NUMBER_ID=123456789012345
META_WEBHOOK_VERIFY_TOKEN=my_secure_token_123

# Generate this
ENCRYPTION_KEY=run_npm_run_generate-key
\`\`\`

### 7. Get Permanent Access Token (Production)

Test tokens expire in 24 hours. For production:

1. In App Dashboard → Settings → Basic
2. Note your **App ID** and **App Secret**
3. Generate System User token:
   - Go to Business Settings
   - Users → System Users
   - Create System User
   - Generate token with these permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
4. This token doesn't expire (unless revoked)

### 8. Register Your Own Phone Number (Production)

To use your own number instead of test number:

1. WhatsApp → Getting Started → Add Phone Number
2. Click "Add Phone Number"
3. Enter your business phone number
4. Verify via SMS or call
5. Complete 2-step verification
6. Your number is now registered!

### 9. Business Verification (Required for Production)

To send messages to any number (not just test numbers):

1. Go to Business Settings → Business Info
2. Click "Start Verification"
3. Upload:
   - Business documents (registration, tax ID)
   - Proof of address
   - Government-issued ID
4. Wait 1-3 business days for review
5. Once approved, you can message any user who messages you first

### 10. Pricing & Limits

#### Free Tier
- **1,000 conversations/month** - FREE
- Perfect for testing and small-scale use

#### After Free Tier
- Pricing varies by country
- Typically $0.005-0.02 per conversation
- A "conversation" is a 24-hour window

#### Rate Limits
- Test Number: 50 messages/day
- Verified Business: Based on quality rating (starts at 1,000/day)

## Webhook Architecture

This app uses **Supabase Edge Functions** for webhooks - no ngrok needed!

### Why Edge Functions?

- **Public HTTPS URL** - No tunneling required
- **Always online** - No need to keep local server running
- **Free tier** - No subscription needed
- **Integrated** - Direct access to your Supabase database

### Your Webhook URL

\`\`\`
https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook
\`\`\`

The edge function handles:
- Webhook verification from Meta
- Incoming message processing
- User and wallet creation
- Transaction processing
- Database operations

## Testing Your Setup

### 1. Verify Webhook

In Meta Dashboard → WhatsApp → Configuration:
- Click "Test" button next to webhook
- Should show "Success"

### 2. Send Test Message

1. Send any message to your WhatsApp Business number
2. Check Supabase logs:
   - Go to Supabase Dashboard → Edge Functions → whatsapp-webhook
   - View logs to see incoming messages
3. Or check your phone - you should get a response!

### 3. Verify Response

Your bot should reply with wallet creation message and your new wallet address

## Troubleshooting

### Webhook Verification Failed
- Check META_WEBHOOK_VERIFY_TOKEN in Supabase Dashboard → Edge Functions → Settings
- Verify the token matches what you're entering in Meta Dashboard
- Test the webhook URL directly: `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test`
- Should return "test" if verification works

### No Messages Received
- Check webhook is subscribed to "messages"
- Verify Access Token is valid (test tokens expire)
- Check server logs for errors
- Ensure phone number is added to "To" field (for test numbers)

### "Access Token Invalid"
- Test tokens expire in 24 hours
- Generate new token from Getting Started page
- Or set up permanent System User token

### Can't Message Other Numbers
- Test number can only message pre-registered "To" numbers
- Register your own number
- Complete business verification

## Production Checklist

Before going live:

- [ ] Register your own phone number
- [ ] Complete business verification
- [ ] Generate permanent access token
- [ ] Edge function already deployed on Supabase
- [ ] Webhook URL is production-ready
- [ ] Set up monitoring and logging
- [ ] Review WhatsApp Business Policy
- [ ] Create message templates for notifications
- [ ] Set up auto-responses
- [ ] Configure business profile

## Useful Links

- [Meta for Developers](https://developers.facebook.com/)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Business Verification Guide](https://www.facebook.com/business/help/2058515294227817)
- [Webhook Reference](https://developers.facebook.com/docs/graph-api/webhooks)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)

## Support

Need help? Check:
- [Meta Developer Community](https://developers.facebook.com/community/)
- [WhatsApp Business API Changelog](https://developers.facebook.com/docs/whatsapp/changelog)
- [Status Page](https://developers.facebook.com/status/)
