# Project Structure

Complete overview of the WhatsApp Crypto Wallet codebase.

## Directory Layout

\`\`\`
whatsapp-crypto-wallet/
├── src/
│   ├── config/
│   │   └── index.js              # Configuration management
│   ├── db/
│   │   └── supabase.js            # Database operations
│   ├── services/
│   │   ├── encryption.js          # Encryption utilities
│   │   ├── wallet.js              # Blockchain wallet operations
│   │   └── whatsapp.js            # WhatsApp API integration
│   ├── handlers/
│   │   └── messageHandler.js     # Message processing logic
│   ├── middleware/
│   │   └── rateLimiter.js         # Rate limiting protection
│   ├── utils/
│   │   └── validator.js           # Input validation
│   └── server.js                  # Express server & webhooks
├── scripts/
│   └── generate-key.js            # Encryption key generator
├── .env                            # Environment variables
├── .gitignore                      # Git ignore rules
├── package.json                    # Dependencies & scripts
├── README.md                       # Main documentation
├── QUICKSTART.md                   # Quick setup guide
├── SETUP.md                        # Meta Cloud API setup
└── PROJECT_STRUCTURE.md            # This file
\`\`\`

## Core Modules

### Configuration (`src/config/`)

**index.js**
- Loads environment variables
- Exports configuration objects for:
  - Supabase connection
  - Meta Cloud API settings
  - Blockchain network (Sepolia)
  - Server settings
- Validates required configuration

### Database (`src/db/`)

**supabase.js**
- Supabase client initialization
- CRUD operations for all tables:
  - `users` - User accounts & wallet data
  - `transactions` - Transaction records
  - `wallet_balances` - Token balances cache
  - `message_sessions` - Conversation state
  - `audit_logs` - Security audit trail
- Helper functions for common queries

### Services (`src/services/`)

**encryption.js**
- AES-256 encryption/decryption
- PIN hashing with SHA-256
- Secure storage of private keys

**wallet.js**
- Create new HD wallets (BIP39)
- Import wallets from private key or mnemonic
- Check ETH balance on Sepolia
- Send transactions
- Estimate gas fees
- Transaction receipt tracking
- Address validation & formatting

**whatsapp.js**
- Send text messages via Meta Cloud API
- Send interactive button messages
- Send list messages
- Parse incoming webhook messages
- Format messages for display:
  - Balance information
  - Transaction confirmations
  - Menu/help text

### Handlers (`src/handlers/`)

**messageHandler.js**
- Main message routing logic
- Command dispatcher
- Session-based conversation flows
- User onboarding flow
- Commands:
  - `balance` - Check wallet balance
  - `send` - Multi-step send flow
  - `receive` - Show wallet address
  - `history` - Transaction list
  - `help` - Show menu

### Middleware (`src/middleware/`)

**rateLimiter.js**
- Prevents abuse and spam
- 20 requests per minute per user
- Automatic cleanup of expired data

### Utils (`src/utils/`)

**validator.js**
- Input sanitization
- Amount validation
- Phone number validation
- Format helpers

### Server (`src/server.js`)

**Express Application**
- REST API endpoints
- Webhook handlers for Meta Cloud API
- Health check endpoint
- Rate limiting middleware
- Error handling

## API Endpoints

### GET /
Returns server information
\`\`\`json
{
  "name": "WhatsApp Crypto Wallet",
  "version": "1.0.0",
  "status": "running",
  "network": "sepolia"
}
\`\`\`

### GET /webhook
Meta webhook verification endpoint
- Validates verify token
- Returns challenge for subscription

### POST /webhook
Receives incoming WhatsApp messages
- Parses message data
- Routes to message handler
- Returns 200 immediately
- Processes async

### GET /health
Health check endpoint
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`

## Database Schema

### users
- `id` (uuid, pk)
- `whatsapp_number` (text, unique)
- `wallet_address` (text, unique)
- `encrypted_private_key` (text)
- `encrypted_mnemonic` (text)
- `pin_hash` (text, nullable)
- `is_onboarded` (boolean)
- `created_at` (timestamptz)
- `last_active` (timestamptz)

### transactions
- `id` (uuid, pk)
- `tx_hash` (text, unique)
- `from_user_id` (uuid, fk → users)
- `to_address` (text)
- `to_user_id` (uuid, fk → users, nullable)
- `amount` (numeric)
- `token_address` (text, nullable)
- `token_symbol` (text)
- `gas_used` (numeric)
- `gas_price` (numeric)
- `status` (text: pending|confirmed|failed)
- `network` (text)
- `block_number` (bigint)
- `created_at` (timestamptz)
- `confirmed_at` (timestamptz)

### wallet_balances
- `id` (uuid, pk)
- `user_id` (uuid, fk → users)
- `token_address` (text, nullable)
- `token_symbol` (text)
- `token_decimals` (int)
- `balance` (numeric)
- `last_updated` (timestamptz)

### message_sessions
- `id` (uuid, pk)
- `user_id` (uuid, fk → users)
- `session_type` (text)
- `session_data` (jsonb)
- `current_step` (text)
- `expires_at` (timestamptz)
- `created_at` (timestamptz)

### audit_logs
- `id` (uuid, pk)
- `user_id` (uuid, fk → users)
- `action` (text)
- `details` (jsonb)
- `ip_address` (text)
- `user_agent` (text)
- `created_at` (timestamptz)

## Message Flow

### New User Flow

1. User sends first message
2. System checks if user exists (by WhatsApp number)
3. If new: Create HD wallet
4. Encrypt private key and mnemonic
5. Store in database
6. Send welcome message with:
   - Wallet address
   - 12-word backup phrase
   - Security warnings
   - Command menu
7. Mark user as onboarded

### Command Flow

1. User sends command (e.g., "balance")
2. System validates user exists
3. Routes to command handler
4. Executes command logic
5. Formats response
6. Sends WhatsApp message
7. Logs action to audit_logs

### Send Money Flow (Session-based)

**Step 1: Initiate**
- User: `send`
- Bot: "Enter recipient address"
- Creates session with type='send_money', step='ask_address'

**Step 2: Collect Address**
- User: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- Validates address
- Updates session: step='ask_amount', data={toAddress}
- Bot: "How much ETH?"

**Step 3: Collect Amount**
- User: `0.01`
- Validates amount
- Checks balance
- Estimates gas
- Updates session: step='confirm', data={toAddress, amount, gas}
- Bot: Shows summary, asks "YES or NO?"

**Step 4: Confirm & Execute**
- User: `YES`
- Creates transaction on blockchain
- Stores in database
- Sends confirmation with tx hash
- Deletes session
- Bot: "Transaction sent! [link to Etherscan]"

## Security Features

### Encryption
- Private keys encrypted with AES-256
- Encryption key stored in environment variable
- Never exposed in logs or API responses

### Row Level Security (RLS)
- Users can only access their own data
- Enforced at database level
- Protection against SQL injection

### Rate Limiting
- 20 requests per minute per user
- Prevents spam and abuse
- Automatic cleanup

### Audit Logging
- All sensitive actions logged
- Includes: wallet creation, transactions, errors
- Useful for debugging and compliance

### Input Validation
- All user input sanitized
- Address validation before transactions
- Amount validation with reasonable limits

## Environment Variables

### Required
- `META_ACCESS_TOKEN` - WhatsApp API token
- `META_PHONE_NUMBER_ID` - WhatsApp number ID
- `META_WEBHOOK_VERIFY_TOKEN` - Webhook verification
- `ENCRYPTION_KEY` - 32-byte hex encryption key

### Pre-configured
- `VITE_SUPABASE_URL` - Database URL
- `VITE_SUPABASE_ANON_KEY` - Database API key
- `SEPOLIA_RPC_URL` - Ethereum RPC endpoint

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: development)

## NPM Scripts

- `npm start` - Start production server
- `npm run dev` - Start with auto-reload
- `npm run generate-key` - Generate encryption key
- `npm test` - Run tests (not implemented yet)

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Web Framework | Express 5 |
| Database | Supabase (PostgreSQL) |
| Blockchain | Ethers.js 6 |
| Messaging | Meta Cloud API |
| Encryption | crypto-js |
| HTTP Client | axios |

## Development Guidelines

### Adding New Commands

1. Add handler function in `messageHandler.js`
2. Register in `commands` object
3. Update help menu in `whatsapp.js`
4. Add audit logging
5. Test thoroughly

### Adding New Tokens

1. Update `wallet.js` with ERC-20 support
2. Add token detection logic
3. Update balance display
4. Modify send flow for token selection

### Security Considerations

- Never log private keys or mnemonics
- Always encrypt before storing
- Validate all user input
- Use RLS for all database tables
- Implement rate limiting on all endpoints
- Keep dependencies updated

## Testing Checklist

- [ ] New user registration
- [ ] Wallet creation & backup phrase
- [ ] Balance check
- [ ] Receive address display
- [ ] Send transaction flow
- [ ] Transaction history
- [ ] Help menu
- [ ] Rate limiting
- [ ] Invalid inputs
- [ ] Network errors
- [ ] Database failures

## Monitoring Points

Monitor these for production:

- Server uptime
- Webhook response time
- Database query performance
- RPC endpoint availability
- Transaction success rate
- Error rates
- Rate limit hits
- User growth
- Transaction volume

## Future Enhancements

See README.md for full list. Key areas:

- ERC-20 token support
- Multi-wallet per user
- Transaction notifications
- DeFi integrations
- Multi-language support
