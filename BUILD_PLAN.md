# 🏗️ COMPREHENSIVE BUILD PLAN
## WhatsApp Crypto Wallet - Chama & On-Ramp Features

---

## 🎯 PROJECT OVERVIEW

Building a complete financial ecosystem with:
- **On-Ramp/Off-Ramp** (Zeno Pay integration)
- **Chama/Group Savings** (Smart contract-based)
- **Loan Module** (Peer-to-peer lending)
- **Multi-token support** (ETH + USDT)

---

## 📊 DEVELOPMENT PHASES

### PHASE 1: Database & Infrastructure Setup ✅
**Estimated Time**: 30 minutes

**1.1 Fix Ethers.js Network Error**
- Current issue: Invalid network configuration
- Solution: Fix `getProvider()` function

**1.2 Database Migrations**
Create tables for:
- `mobile_money_transactions` - Track Zeno Pay transactions
- `chamas` - Group savings accounts
- `chama_members` - Membership records
- `chama_deposits` - Contribution history
- `chama_investments` - ETH investment tracking
- `chama_loans` - Loan records
- `chama_penalties` - Penalty tracking

---

### PHASE 2: Smart Contracts 🔒
**Estimated Time**: 2-3 hours

**Deploy via Remix Ethereum IDE**

**2.1 WalletManager Contract**
- Manages user token balances (ETH + USDT)
- Handles deposits and withdrawals
- Integrates with Chama contracts

**2.2 ChamaFactory Contract**
- Creates new Chama instances
- Generates invite codes
- Registry of all Chamas

**2.3 Chama Contract**
- Member management
- Deposit/withdrawal logic
- Auto-investment (10% to ETH)
- Profit/loss tracking
- Loan issuance & repayment
- Penalty system
- 3-month lockup enforcement

**Deployment Steps**:
1. Copy contract code
2. Open Remix: https://remix.ethereum.org
3. Connect MetaMask to Scroll Sepolia
4. Deploy in order: WalletManager → ChamaFactory → Update references
5. Save contract addresses

---

### PHASE 3: Zeno Pay Integration 💰
**Estimated Time**: 1-2 hours

**3.1 On-Ramp (Deposit from M-Pesa)**
Flow:
- User selects "Deposit" → "From Mobile Money"
- Choose token (ETH/USDT)
- Enter amount (USD/ETH/TZS)
- System triggers Zeno Pay STK push
- User enters PIN on phone
- Payment confirmed → mint equivalent tokens
- WhatsApp notification

**3.2 Off-Ramp (Withdraw to M-Pesa/Bank)**
Flow:
- User selects "Withdraw" → "To Mobile Money"
- Choose token (ETH/USDT)
- Enter amount
- Enter M-Pesa number or bank details
- System burns tokens → triggers Zeno Pay disbursement
- WhatsApp confirmation

**3.3 Webhook Handler**
- Receives Zeno Pay callbacks
- Updates transaction status
- Sends WhatsApp notifications
- Mints/burns tokens as needed

---

### PHASE 4: Chama Module 👥
**Estimated Time**: 3-4 hours

**4.1 Create Chama**
Flow:
- Educational intro
- Enter details:
  - Chama name
  - Description
  - Share price (USD)
  - Weekly minimum contribution
  - Loan interest rate
  - Lockup period (3 months default)
- Deploy smart contract instance
- Generate invite code + URL
- WhatsApp share message

**4.2 Join Chama**
Two methods:
- Click invite URL (auto-opens WhatsApp with code)
- Manual entry via "Join Chama" menu

Flow:
- Display Chama details
- Show terms:
  - Share price
  - Weekly contributions
  - Interest rates
  - 10% auto-investment rule
  - Penalties (1% per missed payment / 12 months)
  - Lockup period
- User accepts → joins contract
- WhatsApp notification to all members

**4.3 Deposit to Chama**
Flow:
- Select deposit source:
  - From wallet (crypto)
  - From mobile money (on-ramp)
- Choose token (ETH/USDT)
- Enter amount (5 decimal max)
- 10% auto-converts to ETH
- Updates:
  - Member contribution
  - Investment pool
  - Loan liquidity
- WhatsApp notification

**4.4 Chama Performance Dashboard**
Display:
- Total contributions
- ETH holdings
- Profit/loss from ETH appreciation
- Loan interest collected
- Penalties collected
- Total Chama value
- Your share percentage

**4.5 Withdraw from Chama**
Requirements:
- ✅ 3-month lockup satisfied
- ✅ No outstanding loans
- ✅ All contributions up-to-date

Flow:
- Check eligibility
- Calculate withdrawal amount (contributions + profit share - penalties)
- Choose destination:
  - To wallet (crypto)
  - To mobile money (off-ramp)
- Process withdrawal
- WhatsApp confirmation

---

### PHASE 5: Loan Module 💵
**Estimated Time**: 2 hours

**5.1 Borrow**
Flow:
- Check Chama membership
- View available liquidity
- Enter loan amount
- View terms:
  - Interest rate (from Chama settings)
  - Repayment schedule
  - Collateral requirements
- Accept terms
- Loan disbursed to wallet
- WhatsApp confirmation

**5.2 Repay**
Flow:
- View outstanding loans
- Select loan to repay
- Enter repayment amount
- Confirm transaction
- Update loan balance
- WhatsApp confirmation

**5.3 View Loan Terms**
Display:
- Active loans
- Interest rates
- Repayment schedule
- Outstanding balance
- Next payment due

---

## 🗂️ FILE STRUCTURE

```
project/
├── supabase/
│   ├── migrations/
│   │   ├── 20251211_add_chama_tables.sql
│   │   ├── 20251211_add_mobile_money_tables.sql
│   │   └── 20251211_add_usdt_support.sql
│   └── functions/
│       ├── whatsapp-webhook/
│       │   └── index.ts (MAIN EDGE FUNCTION)
│       └── zeno-webhook/
│           └── index.ts (Zeno Pay callback handler)
├── contracts/
│   ├── WalletManager.sol
│   ├── ChamaFactory.sol
│   └── Chama.sol
├── scripts/
│   └── deploy-contracts.md (Remix deployment guide)
└── docs/
    ├── BUILD_PLAN.md (this file)
    ├── CHAMA_USER_GUIDE.md
    └── API_INTEGRATION.md
```

---

## 🔑 ENVIRONMENT VARIABLES

Add to `.env`:
```bash
# Existing
META_WEBHOOK_VERIFY_TOKEN=...
META_ACCESS_TOKEN=...
META_PHONE_NUMBER_ID=...
ENCRYPTION_KEY=...
ALCHEMY_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# New - Zeno Pay
ZENO_API_KEY=...

# New - Smart Contracts (after deployment)
WALLET_MANAGER_ADDRESS=...
CHAMA_FACTORY_ADDRESS=...

# New - USDT Contract
USDT_CONTRACT_ADDRESS=... (Scroll Sepolia USDT)
```

---

## 📝 TESTING CHECKLIST

### On-Ramp/Off-Ramp
- [ ] Deposit ETH from M-Pesa
- [ ] Deposit USDT from M-Pesa
- [ ] Withdraw ETH to M-Pesa
- [ ] Withdraw USDT to M-Pesa
- [ ] Test decimal rounding (5 places)
- [ ] Test currency conversions (USD/ETH/TZS)

### Chama Module
- [ ] Create Chama
- [ ] Generate invite code
- [ ] Join via code
- [ ] Join via URL
- [ ] Deposit to Chama
- [ ] View performance
- [ ] Auto-investment (10% to ETH)
- [ ] Withdraw after lockup
- [ ] Penalty calculation
- [ ] Member notifications

### Loan Module
- [ ] Borrow from Chama
- [ ] Repay loan
- [ ] View loan terms
- [ ] Interest calculation
- [ ] Collateral handling

### General
- [ ] Session timeout (3 min)
- [ ] Balance display (all currencies)
- [ ] Transaction history
- [ ] WhatsApp notifications
- [ ] Error handling

---

## 🚀 DEPLOYMENT ORDER

1. **Database Migrations** (Supabase Dashboard)
2. **Smart Contracts** (Remix → Scroll Sepolia)
3. **Update ENV Variables** (Contract addresses)
4. **Edge Functions** (Deploy via Supabase CLI or MCP tool)
5. **Test On-Ramp** (Small amount first)
6. **Test Chama Creation**
7. **Test Full User Journey**

---

## 🆘 SUPPORT & TROUBLESHOOTING

### Common Issues

**1. Network Error (ethers.js)**
- Fix: Update `getProvider()` function (remove invalid options)

**2. Decimal Place Errors**
- Fix: Use `parseFloat(value).toFixed(5)` for all conversions
- Use `ethers.parseUnits(value, 18)` for token amounts

**3. Zeno Pay Timeout**
- Check: API key valid?
- Check: Webhook URL accessible?
- Test: Use Zeno Pay sandbox first

**4. Smart Contract Deployment Failed**
- Check: Scroll Sepolia RPC working?
- Check: Wallet has test ETH?
- Check: Constructor parameters correct?

---

## 📚 NEXT STEPS

After completing all phases:

1. **Mainnet Migration**
   - Deploy contracts to Scroll mainnet
   - Use real USDT contract
   - Switch Zeno Pay to production

2. **Advanced Features**
   - Chama voting/governance
   - Multi-signature withdrawals
   - Advanced loan terms (installments, grace periods)
   - Mobile app integration

3. **Analytics Dashboard**
   - Web dashboard for Chama admins
   - Performance charts
   - Member activity tracking

---

**Status**: Ready to begin implementation
**Next Action**: Fix ethers.js error → Database migrations → Smart contracts
