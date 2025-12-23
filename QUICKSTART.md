# Quick Start Guide

Get your WhatsApp Crypto Wallet running in 5 minutes!

## Step 1: Generate Encryption Key

Run this command to generate a secure encryption key:

\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

Copy the output and add it to your `.env` file:

\`\`\`env
ENCRYPTION_KEY=your_generated_key_here
\`\`\`

## Step 2: Get Meta Cloud API Credentials

### Option A: Use Meta Test Number (Quick Test)

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Navigate to your app → WhatsApp → API Setup
3. You'll see a test number and test access token
4. Copy the following:
   - Test Phone Number ID
   - Test Access Token
5. Add to `.env`:

\`\`\`env
META_ACCESS_TOKEN=your_test_access_token
META_PHONE_NUMBER_ID=your_test_phone_number_id
META_WEBHOOK_VERIFY_TOKEN=my_secure_token_123
\`\`\`

### Option B: Use Production Number (Full Setup)

Follow the complete setup guide in README.md

## Step 3: Environment Variables

All environment variables are already configured in Supabase for the edge function. The local `.env` file is only needed if you want to run the Express server locally for testing.

## Step 4: Setup Webhook

Your webhook is already deployed on Supabase Edge Functions!

**Webhook URL:** `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`

1. In Meta App Dashboard:
   - Go to WhatsApp → Configuration
   - Click "Edit" next to Webhook
   - **Callback URL:** `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token:** Your `META_WEBHOOK_VERIFY_TOKEN` from `.env`
   - Click "Verify and Save"

2. Subscribe to webhook field:
   - Check "messages"
   - Click "Subscribe"

No ngrok needed - your webhook is live 24/7!

## Step 5: Test Your Bot

1. Add your WhatsApp test number to your phone
2. Send any message to start
3. You'll receive your new wallet address and backup phrase
4. Try these commands:
   - `balance` - Check balance
   - `receive` - Get your address
   - `help` - See all commands

## Step 6: Get Test ETH

1. Send `receive` to your bot
2. Copy your wallet address
3. Go to [Sepolia Faucet](https://sepoliafaucet.com)
4. Paste your address and get free test ETH
5. Send `balance` to verify it arrived

## Step 7: Test Sending

1. Send `send` to your bot
2. Enter a recipient address (or create another wallet to test)
3. Enter amount (e.g., `0.01`)
4. Confirm with `YES`
5. Check transaction on [Sepolia Etherscan](https://sepolia.etherscan.io)

## Troubleshooting

### "Meta Cloud API not configured"
- Make sure all META_* variables are in .env
- Restart the server after updating .env

### "Webhook verification failed"
- Check META_WEBHOOK_VERIFY_TOKEN matches in Meta Dashboard
- Test directly: Visit `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test`
- Try clicking "Verify" button again in Meta Dashboard

### "Error checking balance"
- Verify Sepolia RPC URL is accessible
- Check your internet connection
- Try using a different RPC endpoint

### No messages received
- Verify webhook subscription includes "messages"
- Check Supabase logs: Dashboard → Edge Functions → whatsapp-webhook → Logs
- Ensure all environment variables are set in Supabase
- Test webhook with "Test" button in Meta Dashboard

## Next Steps

- ✅ Get testnet ETH and test sending
- ✅ Try all commands (balance, send, receive, history)
- ✅ Test with multiple users
- ✅ Check transaction on Etherscan
- 📖 Read README.md for production deployment
- 🔐 Review security best practices
- 🚀 Deploy to production server

## Need Help?

Check the main README.md for:
- Detailed setup instructions
- API documentation
- Security guidelines
- Production deployment guide
- FAQ and troubleshooting

Enjoy your WhatsApp Crypto Wallet! 🎉
