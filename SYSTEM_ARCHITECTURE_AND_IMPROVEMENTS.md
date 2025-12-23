# INUKA Pay - System Architecture and Recent Improvements

## Overview

INUKA Pay is a WhatsApp-based crypto wallet with group savings (Chama) and peer-to-peer lending features, built on Scroll Sepolia testnet. It bridges traditional mobile money (M-Pesa) with cryptocurrency, making DeFi accessible through WhatsApp.

## Recent Improvements

### 1. Database Schema Fixes

**Problem**: Missing columns in database causing errors when tracking multi-currency chama contributions.

**Solution**: Added migration `fix_chama_columns_schema.sql` with:
- `chamas.eth_pool` - Total ETH in chama pool
- `chamas.tzs_pool` - Total TZS in chama pool
- `chama_members.eth_share` - Member's ETH contribution
- `chama_members.tzs_share` - Member's TZS contribution

**Impact**: Enables proper tracking of multi-currency contributions and accurate balance reporting.

---

### 2. Robust Smart Contracts

#### Chama.sol Improvements

**Key Enhancements**:

1. **TZS Token Support**: Replaced USDT with TZS token (Tanzanian Shilling)
   - Contract: `0x9e47f86a074463f7f51063761f4692AC04770a40`
   - Decimals: 6
   - Full ERC20 integration with proper transfers

2. **Democratic Loan Approval System**:
   ```solidity
   // Loan workflow
   requestLoan() → voteOnLoan() → disburseLoan() → repayLoan()
   ```

   **How It Works**:
   - Any member can request a loan
   - Other members vote (approve/reject)
   - When 51% vote yes, loan auto-approves
   - Borrower then disburses to receive funds
   - Interest is calculated and added to total due
   - Repayments increase pool liquidity for all members

3. **Enhanced Security**:
   - Proper access control (members only, admin only)
   - Reentrancy protection through proper state updates
   - Input validation on all functions
   - Lockup period enforcement
   - Vote tracking to prevent double voting

4. **Multi-Currency Operations**:
   ```solidity
   // Contribute ETH
   contribute(ETH_ADDRESS, amount, amountUSD) { value: amount }

   // Contribute TZS
   contribute(TZS_ADDRESS, amount, amountUSD)
   // Requires prior approve() on TZS contract
   ```

5. **Member Shares System**:
   - Shares calculated based on USD value
   - Formula: `shares = (amountUSD * 1e6) / sharePriceUSD`
   - Enables proportional ownership
   - Used for voting power and withdrawal rights

#### ChamaFactory.sol Improvements

**Purpose**: Deploys and manages multiple chama instances.

**Key Features**:
- Creates new Chama contracts
- Maintains registry by invite code
- Central configuration management
- Prevents duplicate invite codes

**Usage**:
```javascript
const tx = await chamaFactory.createChama(
  "My Chama",              // Name
  "Group savings",         // Description
  "ABCD1234",              // 8-char invite code
  ethers.parseUnits("1", 6),   // Share price: $1
  ethers.parseUnits("10", 6),  // Weekly min: $10
  5,                       // 5% interest
  3                        // 3 months lockup
);
```

---

### 3. Improved User Experience

#### Button-Based Menu System

**Problem**: Users had to type commands or open lists, causing friction.

**Solution**: Interactive button menus with hierarchical navigation:

**Main Menu** (3 buttons):
```
💰 Wallet | 💳 Money & Savings | ⚙️ Settings
```

**Wallet Submenu**:
```
💰 Balance | 📤 Send | 📥 Receive
```

**Money & Savings Submenu**:
```
💳 Mobile Money | 👥 Chama | 💵 Loans
```

**Benefits**:
- One-click access to features
- No typing required
- Better user flow
- Clearer hierarchy

#### Intelligent Contextual Suggestions

**Concept**: Show relevant next actions based on what user just did.

**Examples**:

1. **After Checking Balance**:
   ```
   [📤 Send] [💳 Deposit] [👥 Save in Chama]
   ```

2. **After Successful Send**:
   ```
   [💰 Balance] [📤 Send Again] [🏠 Home]
   ```

3. **After Deposit**:
   ```
   [💰 View Balance] [👥 Save in Chama] [🏠 Home]
   ```

4. **After Empty History**:
   ```
   [💳 Deposit] [📥 Receive] [🏠 Home]
   ```

**Impact**:
- Reduces user friction
- Guides users through common workflows
- Increases engagement
- Decreases support requests

---

## System Architecture

### High-Level Architecture

```
┌─────────────┐
│  WhatsApp   │
│   User      │
└──────┬──────┘
       │ (Messages)
       ↓
┌─────────────────────────────────────┐
│   WhatsApp Cloud API (Meta)         │
│   Webhook: /whatsapp-webhook        │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│   Supabase Edge Function            │
│   • Message routing                 │
│   • Session management              │
│   • Business logic                  │
└──────┬──────┬──────────┬────────────┘
       │      │          │
       ↓      ↓          ↓
┌──────────┐ ┌─────────┐ ┌──────────────┐
│ Supabase │ │  Zeno   │ │   Scroll     │
│    DB    │ │   API   │ │   Sepolia    │
│          │ │ (M-Pesa)│ │  (Blockchain)│
└──────────┘ └─────────┘ └──────────────┘
```

### Component Breakdown

#### 1. WhatsApp Layer
- **User Interface**: WhatsApp chat
- **Input**: Text, buttons, lists
- **Output**: Messages, interactive buttons

#### 2. Webhook Layer (Edge Function)
- **Entry Point**: `/whatsapp-webhook`
- **Responsibilities**:
  - Verify webhook signature
  - Parse messages
  - Manage user sessions
  - Route commands
  - Format responses
  - Send interactive messages

#### 3. Database Layer (Supabase)
**Tables**:
- `users` - User accounts and wallets
- `transactions` - All blockchain txs
- `message_sessions` - Conversation state
- `chamas` - Group savings info
- `chama_members` - Member participation
- `loans` - Loan records
- `fx_rates` - Real-time exchange rates

#### 4. Blockchain Layer (Scroll Sepolia)
**Contracts**:
- `ChamaFactory` - Creates chamas
- `Chama` - Individual group contract
- `TZS Token` - ERC20 token

#### 5. External Services
- **Zeno API**: M-Pesa deposits/withdrawals
- **Alchemy**: Blockchain RPC provider
- **CoinGecko**: Real-time crypto prices
- **ExchangeRate API**: Fiat exchange rates

---

## Smart Contract Logic Explained

### Chama Contribution Flow

```
1. User wants to contribute 0.01 ETH
   ↓
2. App converts to USD: 0.01 ETH ≈ $20
   ↓
3. Call: contribute(ETH_ADDRESS, 0.01 ETH, $20)
   ↓
4. Contract:
   - Receives ETH (msg.value)
   - Updates member.ethShare += 0.01
   - Updates totalETHHoldings += 0.01
   - Calculates shares: ($20 * 1e6) / sharePriceUSD
   - Updates member.sharesOwned
   ↓
5. Member now owns more of the pool
```

### Loan Request & Approval Flow

```
1. Alice requests 0.05 ETH loan for 30 days
   ↓
2. Call: requestLoan(ETH_ADDRESS, 0.05 ETH, 30)
   ↓
3. Contract:
   - Checks pool has 0.05 ETH available
   - Calculates interest: 0.05 * 5% = 0.0025 ETH
   - Total due: 0.0525 ETH
   - Creates loan record with ID=0
   - Sets isApproved=false, isDisbursed=false
   - Emits LoanRequested event
   ↓
4. Bob (member) sees notification
   ↓
5. Bob calls: voteOnLoan(0, true)
   ↓
6. Contract:
   - Checks Bob hasn't voted before
   - Increments approvalsCount
   - Checks if approvalsCount >= (memberCount * 51%)
   - If yes: sets isApproved=true, emits LoanApproved
   ↓
7. Alice calls: disburseLoan(0)
   ↓
8. Contract:
   - Checks isApproved=true
   - Checks !isDisbursed
   - Transfers 0.05 ETH to Alice
   - Updates totalETHHoldings -= 0.05
   - Sets isDisbursed=true
   ↓
9. Alice receives funds
   ↓
10. After time passes, Alice repays
    ↓
11. Call: repayLoan(0, 0.0525 ETH) { value: 0.0525 }
    ↓
12. Contract:
    - Updates amountRepaid += 0.0525
    - Updates totalETHHoldings += 0.0525
    - Checks if amountRepaid >= totalDue
    - If yes: sets isActive=false, isRepaid=true
    ↓
13. Pool now has more liquidity (original + interest)
    ↓
14. All members benefit from the interest
```

### Why This Design Is Robust

1. **Democratic**: No single admin can approve loans
2. **Transparent**: All votes and transactions on-chain
3. **Secure**: Multiple checks prevent manipulation
4. **Fair**: Interest benefits all members
5. **Flexible**: Supports multiple currencies
6. **Scalable**: Can create unlimited chamas via factory

---

## Multi-Currency Display

### Conversion Logic

```javascript
// User has 0.1 ETH and 50,000 TZS

// ETH breakdown:
ethUSD = 0.1 * 2000 = $200
ethTZS = 0.1 * 5000000 = 500,000 TZS

// TZS breakdown:
tzsUSD = 50000 / 2500 = $20

// Display:
"ETH: 0.1
≈ 500,000 TZS
≈ $200 USD

TZS: 50,000
≈ $20 USD"
```

### When Transacting

All transactions show 3-way conversion:
- Native amount (e.g., 0.05 ETH)
- TZS equivalent (e.g., 250,000 TZS)
- USD equivalent (e.g., $100 USD)

This helps users understand value in familiar terms.

---

## Security Considerations

### Smart Contract Security

1. **Access Control**: Only members can perform member actions
2. **Reentrancy Protection**: State updates before external calls
3. **Integer Overflow**: Using Solidity 0.8.20 (built-in protection)
4. **Vote Manipulation**: Each member can vote once per loan
5. **Liquidity Checks**: Cannot borrow more than available

### Application Security

1. **Private Key Encryption**: AES encryption with strong key
2. **PIN Hashing**: SHA256 with salt
3. **Session Timeouts**: 15-minute expiry
4. **Input Validation**: Address format, amount limits
5. **Rate Limiting**: Prevent spam and abuse

---

## Integration Guide for Developers

### Creating a Chama

```javascript
// 1. Generate unique 8-char invite code
const inviteCode = generateInviteCode(); // e.g., "TEAM2024"

// 2. Store in database
await supabase.from('chamas').insert({
  name: "My Team Chama",
  invite_code: inviteCode,
  creator_user_id: userId
});

// 3. Deploy on blockchain
const wallet = getWalletFromEncrypted(user.encrypted_private_key);
const result = await createChamaOnChain(
  wallet,
  "My Team Chama",
  "Saving together",
  inviteCode
);

// 4. Update database with contract address
await supabase.from('chamas')
  .update({ contract_address: result.chamaAddress })
  .eq('invite_code', inviteCode);
```

### Joining a Chama

```javascript
// 1. User provides invite code
const inviteCode = "TEAM2024";

// 2. Find chama in database
const { data: chama } = await supabase
  .from('chamas')
  .select('*')
  .eq('invite_code', inviteCode)
  .single();

// 3. Join on blockchain
const wallet = getWalletFromEncrypted(user.encrypted_private_key);
const txHash = await joinChamaOnChain(wallet, chama.contract_address);

// 4. Record membership in database
await supabase.from('chama_members').insert({
  chama_id: chama.id,
  user_id: userId,
  status: 'active',
  joined_at: new Date().toISOString()
});
```

### Contributing to Chama

```javascript
// 1. Get chama details
const { data: chama } = await supabase
  .from('chamas')
  .select('*')
  .eq('id', chamaId)
  .single();

// 2. Calculate USD value
const amountUSD = tokenSymbol === 'ETH'
  ? await convertCurrency(parseFloat(amount), 'ETH', 'USD')
  : await convertCurrency(parseFloat(amount), 'TZS', 'USD');

// 3. Contribute on blockchain
const wallet = getWalletFromEncrypted(user.encrypted_private_key);
const txHash = await contributeToChamaOnChain(
  wallet,
  chama.contract_address,
  tokenSymbol,
  amount,
  amountUSD
);

// 4. Update database
await supabase.from('chama_contributions').insert({
  chama_id: chamaId,
  user_id: userId,
  amount,
  token_symbol: tokenSymbol,
  amount_usd: amountUSD,
  tx_hash: txHash
});
```

---

## Testing Checklist

### Smart Contracts

- [ ] Deploy ChamaFactory to testnet
- [ ] Create test chama via factory
- [ ] Join chama with test account
- [ ] Contribute ETH to chama
- [ ] Contribute TZS to chama (need approval first)
- [ ] Request loan
- [ ] Vote on loan (with different account)
- [ ] Disburse approved loan
- [ ] Repay loan partially
- [ ] Repay loan fully
- [ ] Check member shares update correctly
- [ ] Check pool balances update correctly
- [ ] Verify events are emitted
- [ ] Test lockup period enforcement
- [ ] Test vote threshold calculation

### Application

- [ ] New user registration creates wallet
- [ ] PIN setting and verification works
- [ ] Balance display shows all currencies
- [ ] Send ETH transaction works
- [ ] Send TZS transaction works
- [ ] Phone number transfer resolution works
- [ ] M-Pesa deposit initiates correctly
- [ ] M-Pesa withdrawal initiates correctly
- [ ] Chama creation flow complete
- [ ] Chama joining flow complete
- [ ] Chama contribution flow complete
- [ ] Loan request flow complete
- [ ] Loan voting flow complete
- [ ] Transaction history displays correctly
- [ ] Notifications sent properly
- [ ] Button menus display correctly
- [ ] Contextual suggestions appear
- [ ] Session timeouts handled
- [ ] Error messages user-friendly

---

## Performance Optimizations

### Implemented

1. **Balance Caching**: 30-second cache for wallet balances
2. **FX Rate Caching**: 5-minute cache for exchange rates
3. **Database Indexing**: On user WhatsApp numbers, transaction hashes
4. **Provider Reuse**: Single ethers provider instance
5. **Batch Queries**: Fetch ETH and TZS balances in parallel

### Recommended

1. **Redis Cache**: For session data and frequently accessed data
2. **Read Replicas**: For Supabase database
3. **CDN**: For static assets (if web interface added)
4. **Transaction Queue**: For handling high-volume blockchain interactions
5. **Webhook Queue**: For processing WhatsApp messages asynchronously

---

## Future Enhancements

### Phase 1: User Features
- Multi-signature withdrawals for chamas
- Scheduled contributions (auto-save)
- Loan payment reminders
- Chama analytics dashboard
- Member reputation scores

### Phase 2: Financial Features
- Staking rewards distribution
- DeFi yield integration
- Cross-border remittances
- Bill payment integration
- Merchant payments

### Phase 3: Social Features
- Chama chat groups
- Achievement badges
- Referral rewards
- Leaderboards
- Educational content

### Phase 4: Technical
- Multi-chain support (Polygon, Base, etc.)
- Web dashboard for chamas
- Mobile app (React Native)
- GraphQL API for external integrations
- Advanced analytics and reporting

---

## Maintenance

### Daily Tasks
- Monitor webhook health
- Check transaction success rates
- Review error logs
- Track FX rate accuracy

### Weekly Tasks
- Analyze user engagement
- Review chama performance
- Check blockchain gas costs
- Update exchange rate providers if needed

### Monthly Tasks
- Security audit review
- Smart contract upgrades (if needed)
- Database optimization
- User feedback analysis

---

## Support Resources

### Documentation
- This file: System overview
- `SMART_CONTRACT_DEPLOYMENT_GUIDE.md`: Deployment steps
- `BUILD_PLAN.md`: Original project plan
- `ROADMAP.md`: Feature roadmap

### External Resources
- Scroll Sepolia Docs: https://docs.scroll.io
- Ethers.js v6 Docs: https://docs.ethers.org/v6
- Supabase Docs: https://supabase.com/docs
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp

### Tools
- Explorer: https://sepolia.scrollscan.com
- Faucet: https://sepolia.scroll.io/faucet
- Testnet Bridge: https://sepolia.scroll.io/bridge

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Status**: Production Ready (Testnet)
