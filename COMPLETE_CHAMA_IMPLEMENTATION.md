# Complete Chama Implementation Guide

## Overview
The system now fully integrates blockchain operations for all Chama activities through the new Chama.sol contract. The ChamaFactory handles creation only, while individual Chama contracts manage all operations.

## Architecture

### Smart Contracts
1. **ChamaFactory.sol** - Creates new Chama instances
2. **Chama.sol** - Manages all chama operations:
   - Member management (join, leave)
   - Contributions (ETH & TZS)
   - Withdrawals (with lockup period)
   - Loan requests
   - Loan voting (approval/rejection)
   - Loan disbursement
   - Loan repayment

### Edge Functions Integration

All blockchain operations are now handled in `blockchain.ts` with the following functions:

#### Chama Management
- `createChamaOnChain()` - Creates chama via factory
- `joinChamaOnChain()` - Member joins chama
- `contributeToChamaOnChain()` - Contribute ETH/TZS
- `withdrawFromChamaOnChain()` - Withdraw funds (after lockup)

#### Loan Operations
- `requestLoanOnChain()` - Request loan from pool
- `voteOnLoanOnChain()` - Vote on loan requests
- `disburseLoanOnChain()` - Claim approved loan
- `repayLoanOnChain()` - Repay loan

#### View Functions
- `getChamaSummaryOnChain()` - Get chama stats
- `getMemberOnChain()` - Get member details
- `getLoanOnChain()` - Get loan details
- `isMemberOnChain()` - Check membership

## Complete User Flows

### 1. Create Chama
1. User sends: `create_chama`
2. System asks for name
3. User provides name
4. System asks for description
5. User provides description
6. System asks for PIN
7. User provides PIN
8. **Blockchain**: Factory creates Chama contract
9. **Database**: Stores chama with `contract_address`
10. User receives confirmation with contract address and invite code

### 2. Join Chama
1. User sends: `join_chama`
2. System asks for invite code
3. User provides code
4. **Blockchain**: Calls `joinChama()` on contract
5. **Database**: Creates membership record
6. User receives confirmation with transaction link

### 3. Contribute to Chama
1. User selects chama
2. User clicks "Contribute"
3. User selects token (ETH/TZS)
4. User enters amount
5. User enters PIN
6. **For TZS**:
   - System checks balance
   - System approves TZS to chama contract
   - System calls `contribute()`
7. **For ETH**:
   - System calls `contribute()` with value
8. **Database**: Records contribution
9. User receives confirmation with transaction link

### 4. Request Loan
1. User selects chama
2. User clicks "Request Loan"
3. User enters amount (in TZS)
4. User enters duration (in months)
5. User enters PIN
6. **Blockchain**: Calls `requestLoan()` → returns `loanId`
7. **Database**: Stores loan with `on_chain_loan_id`
8. **Notification**: All members notified to vote
9. User receives confirmation with loan ID

### 5. Vote on Loan
1. Member receives notification: "Reply *approve_{loanId}* or *deny_{loanId}*"
2. Member sends: `approve_123` or `deny_123`
3. **Blockchain**: Calls `voteOnLoan(loanId, true/false)`
4. **Database**: Updates approval count
5. **If approved** (reaches required votes):
   - Loan status changes to "approved"
   - Borrower notified to disburse
6. Voter receives confirmation with vote count

### 6. Disburse Loan (After Approval)
1. Borrower receives: "Loan approved! Reply *disburse_{loanId}*"
2. Borrower sends: `disburse_123`
3. **Blockchain**: Calls `disburseLoan(loanId)`
   - Funds transferred to borrower
   - Chama pool reduced
4. **Database**: Updates loan status to "active"
5. Borrower receives funds + transaction link

### 7. Repay Loan
1. User has active loan
2. User initiates payment
3. User enters amount
4. User enters PIN
5. **For TZS**:
   - System approves TZS to chama contract
   - System calls `repayLoan(loanId, amount)`
6. **Blockchain**: Transfers tokens to chama pool
7. **Database**: Updates outstanding balance
8. **If fully paid**: Status changes to "paid"
9. User receives confirmation

### 8. Withdraw from Chama
1. User must wait for lockup period (3 months default)
2. User selects token to withdraw
3. User enters amount
4. User enters PIN
5. **Blockchain**: Calls `withdraw(token, amount)`
   - Checks lockup period
   - Checks user's share
   - Transfers funds to user
6. **Database**: Updates member shares
7. User receives funds + transaction link

## Database Schema

### chamas table
```sql
- contract_address: text           -- Deployed Chama contract address
- creation_tx_hash: text           -- Creation transaction
- creation_explorer_link: text     -- Explorer URL
```

### chama_loans table
```sql
- on_chain_loan_id: integer        -- Loan ID from smart contract
- tx_hash: text                    -- Request transaction
- vote_tx_hashes: jsonb            -- Map of voter → tx hash
- disbursement_tx_hash: text       -- Disbursement transaction
- repayment_tx_hashes: jsonb       -- Array of repayment txs
```

### chama_contributions table
```sql
- tx_hash: text                    -- Contribution transaction
- explorer_link: text              -- Explorer URL
- amount_crypto: decimal           -- Amount in token
- amount_usd: decimal              -- USD equivalent
```

## Smart Contract Configuration

### Chama Parameters (Set on Creation)
- `sharePriceUSD`: Price per share (default: $10 with 6 decimals)
- `weeklyMinimumContribution`: Min weekly contribution (default: $5)
- `loanInterestRate`: Interest rate percentage (default: 5%)
- `lockupPeriodMonths`: Withdrawal lockup (default: 3 months)
- `minVotesForApproval`: Approval threshold (default: 51%)

### Token Addresses
- **ETH**: `0x0000000000000000000000000000000000000000`
- **TZS Token**: `0x9e47f86a074463f7f51063761f4692AC04770a40`

## Security Features

### Smart Contract Security
1. **Member-only operations**: Only active members can contribute/borrow
2. **Vote restrictions**: Cannot vote on own loan
3. **Lockup enforcement**: Withdrawals blocked during lockup period
4. **Balance checks**: All operations verify sufficient funds
5. **Reentrancy protection**: Follows checks-effects-interactions pattern

### Application Security
1. **PIN verification**: All sensitive operations require PIN
2. **Rate limiting**: Prevents spam/abuse
3. **Private key encryption**: User keys encrypted in database
4. **RLS policies**: Database-level access control

## Error Handling

All blockchain operations return:
```typescript
{
  success: boolean;
  txHash?: string;
  explorerLink?: string;
  error?: string;
}
```

Failures are gracefully handled:
- Clear error messages to users
- Fallback to off-chain tracking if blockchain fails
- Transaction links for successful operations

## Deployment Checklist

### 1. Deploy Smart Contracts
```bash
# Deploy ChamaFactory
# Set TZS_TOKEN_ADDRESS
# Set CHAMA_FACTORY_ADDRESS in .env
```

### 2. Update Environment Variables
```env
CHAMA_FACTORY_ADDRESS=0x305e...
TZS_TOKEN_ADDRESS=0x9e47...
SCROLL_SEPOLIA_RPC_URL=https://sepolia-rpc.scroll.io
BLOCKCHAIN_EXPLORER_URL=https://sepolia.scrollscan.com
MASTER_WALLET_PRIVATE_KEY=0x...
```

### 3. Deploy Edge Functions
```bash
# Deploy whatsapp-webhook with both files:
# - index.ts
# - blockchain.ts
```

### 4. Test Complete Flows
- [ ] Create chama
- [ ] Join chama
- [ ] Contribute (ETH & TZS)
- [ ] Request loan
- [ ] Vote on loan
- [ ] Disburse loan
- [ ] Repay loan
- [ ] Withdraw funds

## Monitoring & Debugging

### View On-Chain State
Use the view functions to check contract state:
```typescript
const summary = await getChamaSummaryOnChain(chamaAddress);
const member = await getMemberOnChain(chamaAddress, userAddress);
const loan = await getLoanOnChain(chamaAddress, loanId);
```

### Track Transactions
All transactions are stored with:
- `tx_hash`: Transaction hash
- `explorer_link`: Block explorer URL

Users can verify all operations on Scroll Sepolia Explorer.

## Future Enhancements

1. **Multi-currency support**: Add more tokens
2. **Governance**: Vote on chama settings changes
3. **Penalties**: Automatic penalties for missed contributions
4. **Rewards**: Bonus shares for consistent contributors
5. **Insurance**: Pool insurance for defaults
6. **Analytics**: On-chain data analysis and reporting

## Support & Troubleshooting

### Common Issues

**Issue**: "Insufficient allowance"
**Solution**: TZS approval happens automatically, wait for approval tx

**Issue**: "Lockup period not met"
**Solution**: Withdrawals require 3 months minimum membership

**Issue**: "Loan not approved"
**Solution**: Need 51% of members to approve (check vote count)

**Issue**: "Already voted"
**Solution**: Each member can only vote once per loan

### Contract Verification
Verify contracts on Scroll Sepolia:
1. Get contract address from chama details
2. Visit: `https://sepolia.scrollscan.com/address/{address}`
3. View all transactions and state changes

## Conclusion

The complete Chama system is now fully integrated with blockchain:
- ✅ All operations on-chain
- ✅ Transparent and verifiable
- ✅ Secure and auditable
- ✅ User-friendly via WhatsApp
- ✅ Comprehensive error handling
- ✅ Full transaction tracking

Users can manage their savings groups entirely through WhatsApp while benefiting from blockchain security and transparency!
