# WhatsApp Crypto Wallet

A WhatsApp-based cryptocurrency wallet built with Meta Cloud API and Sepolia testnet.

## Features

- 💰 Create Ethereum wallet directly from WhatsApp
- 📤 Send ETH to any address
- 📥 Receive ETH with your wallet address
- 💵 Check balance in real-time
- 📊 View transaction history
- 🔐 Encrypted private key storage
- ⛓️ Sepolia testnet support

## Tech Stack

- **Backend:** Supabase Edge Functions + Node.js (optional local testing)
- **Blockchain:** Ethers.js + Sepolia Testnet
- **Database:** Supabase PostgreSQL
- **Messaging:** Meta Cloud API (WhatsApp Business)
- **Security:** AES-256 encryption

## Prerequisites

1. Node.js 18+ installed
2. Meta Business Account with WhatsApp Business API access
3. Supabase account (already configured)

## Setup Instructions

### 1. Meta Cloud API Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing Business app
3. Add WhatsApp product to your app
4. Get your credentials:
   - **Access Token:** From WhatsApp > API Setup
   - **Phone Number ID:** From WhatsApp > API Setup
   - **Webhook Verify Token:** Create a random string (e.g., "my_secure_token_123")
   - **Business Account ID:** From App Settings

### 2. Environment Variables

Update your `.env` file with Meta Cloud API credentials:

\`\`\`env
META_ACCESS_TOKEN=your_meta_cloud_api_access_token_here
META_PHONE_NUMBER_ID=your_whatsapp_phone_number_id_here
META_WEBHOOK_VERIFY_TOKEN=your_webhook_verification_token_here
META_BUSINESS_ACCOUNT_ID=your_business_account_id_here
\`\`\`

Also generate a secure encryption key:

\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

Add it to `.env`:

\`\`\`env
ENCRYPTION_KEY=your_generated_encryption_key_here
\`\`\`

### 3. Webhook Configuration

Your webhook is already deployed on Supabase Edge Functions!

**Webhook URL:** `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`

1. In Meta App Dashboard > WhatsApp > Configuration:
   - Click "Edit" next to Webhook
   - **Callback URL:** `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token:** Use your `META_WEBHOOK_VERIFY_TOKEN`
   - Click "Verify and Save"
   - Subscribe to webhook fields: `messages`

The edge function is live 24/7 - no local server or ngrok needed!

### 4. Test the Application

Your bot is ready! No need to run a local server.

To test locally (optional):
\`\`\`bash
# Install dependencies
npm install

# Start local server
npm start
\`\`\`

But the production webhook is already running on Supabase Edge Functions!

## How It Works

### User Flow

1. **First Message:** User sends any message to your WhatsApp Business number
2. **Wallet Creation:** System automatically creates a new Ethereum wallet
3. **Backup Phrase:** User receives 12-word mnemonic phrase (must save it!)
4. **Commands:** User can now use various commands

### Available Commands

- \`balance\` - Check your wallet balance
- \`send\` - Send ETH to an address (interactive flow)
- \`receive\` - Get your wallet address to receive ETH
- \`history\` - View last 5 transactions
- \`help\` - Show all available commands

### Send Money Flow

1. User types: \`send\`
2. Bot asks: "Enter recipient address"
3. User provides Ethereum address
4. Bot asks: "How much ETH?"
5. User enters amount (e.g., 0.01)
6. Bot shows summary + gas estimate
7. User confirms: \`YES\` or \`NO\`
8. Transaction sent + confirmation with Etherscan link

## Database Schema

- **users:** WhatsApp number, wallet address, encrypted keys
- **transactions:** Transaction history with status tracking
- **wallet_balances:** Cached balance for each token
- **message_sessions:** Multi-step conversation state
- **audit_logs:** Security and compliance tracking

## Security Features

- Private keys encrypted with AES-256
- Row-Level Security (RLS) on all database tables
- Backup phrase shown only once during creation
- Secure session management for multi-step flows
- Audit logging for all sensitive operations

## Testing

### Get Testnet ETH

1. Visit [Sepolia Faucet](https://sepoliafaucet.com)
2. Enter your wallet address (from WhatsApp)
3. Receive free test ETH
4. Try sending transactions!

### Test Commands

Send these messages to your WhatsApp bot:

\`\`\`
balance
send
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
0.01
YES
history
\`\`\`

## API Endpoints

Edge Function endpoints:

- `GET /whatsapp-webhook` - Webhook verification (for Meta)
- `POST /whatsapp-webhook` - Incoming WhatsApp messages

Full URL: `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`

## Troubleshooting

### "Meta Cloud API not configured"

Make sure all environment variables in \`.env\` are set correctly.

### Webhook not receiving messages

1. Verify webhook URL in Meta Dashboard is correct
2. Check webhook subscriptions include "messages"
3. Test webhook with "Test" button in Meta Dashboard
4. Check Supabase logs: Dashboard → Edge Functions → whatsapp-webhook → Logs
5. Ensure environment variables are set in Supabase

### Transaction fails

1. Check you have enough testnet ETH
2. Verify gas estimates are reasonable
3. Check Sepolia RPC is responding
4. View transaction on [Sepolia Etherscan](https://sepolia.etherscan.io)

## Production Deployment

### Security Checklist

- [ ] Change \`ENCRYPTION_KEY\` to strong random value
- [ ] Use production Meta Cloud API credentials
- [ ] Enable HTTPS/SSL on your server
- [ ] Set up proper monitoring and alerts
- [ ] Configure rate limiting
- [ ] Add PIN verification for transactions
- [ ] Implement backup/recovery flows
- [ ] Add transaction limits

### Mainnet Migration

To move to Ethereum mainnet:

1. Update \`.env\`:
   \`\`\`env
   SEPOLIA_RPC_URL=https://ethereum-rpc.publicnode.com
   NETWORK=mainnet
   CHAIN_ID=1
   \`\`\`
2. Test thoroughly on testnet first!
3. Implement additional security measures
4. Consider multi-sig or cold storage for large amounts

## Future Enhancements

- [ ] ERC-20 token support (USDC, USDT, etc.)
- [ ] Multi-wallet support per user
- [ ] Contact book for frequent recipients
- [ ] QR code generation for addresses
- [ ] Transaction notifications
- [ ] Price alerts
- [ ] DeFi integrations
- [ ] Multi-language support
- [ ] Voice commands

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Meta Cloud API docs
3. Check Supabase logs
4. Review server logs

## License

MIT
