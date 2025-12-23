# 🚀 REMIX DEPLOYMENT GUIDE
## Deploy Smart Contracts to Scroll Sepolia

---

## 📋 PREREQUISITES

Before starting, ensure you have:

1. ✅ **MetaMask installed** (browser extension)
2. ✅ **Scroll Sepolia testnet added** to MetaMask
3. ✅ **Test ETH on Scroll Sepolia** (from faucet)
4. ✅ **USDT contract address** for Scroll Sepolia

---

## 🌐 SETUP METAMASK FOR SCROLL SEPOLIA

### Step 1: Add Scroll Sepolia Network

1. Open MetaMask
2. Click network dropdown → "Add Network" → "Add network manually"
3. Enter these details:

```
Network Name: Scroll Sepolia
RPC URL: https://sepolia-rpc.scroll.io
Chain ID: 534351
Currency Symbol: ETH
Block Explorer: https://sepolia.scrollscan.com
```

4. Click "Save"

### Step 2: Get Test ETH

1. Visit: https://scroll.io/portal/faucet
2. Connect your MetaMask wallet
3. Request test ETH
4. Wait for confirmation (usually 1-2 minutes)

### Step 3: Get USDT Contract Address

For Scroll Sepolia testnet USDT:
```
USDT Address: 0x... (You'll need to deploy or use existing USDT)
```

**Note**: If no USDT exists on Scroll Sepolia, you can deploy a simple mock USDT for testing.

---

## 🏗️ DEPLOYMENT STEPS

### PHASE 1: Deploy WalletManager Contract

#### Step 1: Open Remix
1. Go to: https://remix.ethereum.org
2. Wait for Remix to load

#### Step 2: Create WalletManager.sol File
1. In the File Explorer (left sidebar), click "Create New File"
2. Name it: `WalletManager.sol`
3. Copy the entire content from `contracts/WalletManager.sol`
4. Paste it into the Remix editor

#### Step 3: Compile WalletManager
1. Click the "Solidity Compiler" tab (left sidebar, 2nd icon)
2. Select compiler version: `0.8.20` or higher
3. Click "Compile WalletManager.sol"
4. Wait for green checkmark ✅

#### Step 4: Deploy WalletManager
1. Click "Deploy & Run Transactions" tab (left sidebar, 3rd icon)
2. Select Environment: "Injected Provider - MetaMask"
3. MetaMask will pop up → Click "Connect"
4. Confirm you're on **Scroll Sepolia** network
5. Select contract: "WalletManager"
6. Click "Deploy" (orange button)
7. MetaMask will pop up → Review gas fees → Click "Confirm"
8. Wait for deployment (10-20 seconds)

#### Step 5: Save WalletManager Address
1. In Remix, look at "Deployed Contracts" section
2. Copy the contract address (starts with 0x...)
3. Save it as: `WALLET_MANAGER_ADDRESS`

**Example**:
```
WALLET_MANAGER_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
```

---

### PHASE 2: Deploy ChamaFactory Contract

#### Step 1: Create Chama.sol File
1. Create new file: `Chama.sol`
2. Copy content from `contracts/Chama.sol`
3. Paste into Remix editor

#### Step 2: Create ChamaFactory.sol File
1. Create new file: `ChamaFactory.sol`
2. Copy content from `contracts/ChamaFactory.sol`
3. Paste into Remix editor

#### Step 3: Compile Both Contracts
1. Click "Solidity Compiler" tab
2. Select compiler: `0.8.20`
3. Click "Compile Chama.sol" → Wait for ✅
4. Click "Compile ChamaFactory.sol" → Wait for ✅

#### Step 4: Deploy ChamaFactory
1. Click "Deploy & Run Transactions" tab
2. Select contract: "ChamaFactory"
3. **IMPORTANT**: You need constructor parameters!

**Constructor Parameters**:
```
_walletManager: [YOUR_WALLET_MANAGER_ADDRESS]
_usdtAddress: [SCROLL_SEPOLIA_USDT_ADDRESS]
```

**Example**:
```
_walletManager: "0x1234567890abcdef1234567890abcdef12345678"
_usdtAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
```

4. Enter parameters (in quotes, comma-separated)
5. Click "Deploy"
6. Confirm in MetaMask
7. Wait for deployment

#### Step 5: Save ChamaFactory Address
Copy and save as: `CHAMA_FACTORY_ADDRESS`

---

## ✅ VERIFY DEPLOYMENTS

### Check WalletManager

1. In Remix, expand your deployed WalletManager contract
2. Click "owner" (view function)
3. Should return your wallet address

### Check ChamaFactory

1. Expand deployed ChamaFactory contract
2. Click "walletManager" → Should return WalletManager address
3. Click "usdtAddress" → Should return USDT address
4. Click "getTotalChamas" → Should return 0

---

## 📝 SAVE CONTRACT ADDRESSES

Add these to your `.env` file:

```bash
# Smart Contract Addresses
WALLET_MANAGER_ADDRESS=0x...
CHAMA_FACTORY_ADDRESS=0x...
USDT_CONTRACT_ADDRESS=0x...

# Network
SCROLL_SEPOLIA_CHAIN_ID=534351
SCROLL_SEPOLIA_RPC=https://sepolia-rpc.scroll.io
```

---

## 🔍 VERIFY ON BLOCK EXPLORER

1. Go to: https://sepolia.scrollscan.com
2. Paste your contract addresses
3. You should see:
   - Contract creation transaction
   - Contract code
   - Transactions (if any)

### Optional: Verify Contract Code

1. On Scrollscan, go to your contract page
2. Click "Contract" tab → "Verify and Publish"
3. Select:
   - Compiler: 0.8.20
   - License: MIT
4. Paste your contract code
5. Click "Verify"

This makes your contract readable on the explorer!

---

## 🧪 TEST CONTRACTS

### Test WalletManager

Run these functions in Remix:

```solidity
// 1. Deposit ETH
depositETH(YOUR_ADDRESS)
// Send some ETH value (e.g., 0.001)

// 2. Check balance
getETHBalance(YOUR_ADDRESS)
// Should return your deposited amount
```

### Test ChamaFactory

```solidity
// 1. Create a test Chama
createChama(
    "Test Chama",                    // name
    "Testing purposes",              // description
    "TEST1234",                      // inviteCode (8 chars)
    10000000000000000000,            // sharePriceUSD (10 USD)
    5000000000000000000,             // weeklyMinimum (5 USD)
    5,                               // loanInterestRate (5%)
    3,                               // lockupMonths
    10                               // autoInvestPct (10%)
)

// 2. Get Chama address
getChamaByInviteCode("TEST1234")
// Should return Chama contract address

// 3. Check total Chamas
getTotalChamas()
// Should return 1
```

---

## 🐛 TROUBLESHOOTING

### Issue: "Gas estimation failed"
**Solution**:
- Check you have enough test ETH
- Verify constructor parameters are correct
- Try increasing gas limit manually

### Issue: "Invalid address"
**Solution**:
- Ensure addresses are in correct format (0x...)
- Don't include quotes when copying addresses
- Verify network is Scroll Sepolia

### Issue: "Execution reverted"
**Solution**:
- Check constructor parameters match expected types
- Ensure USDT address is valid
- Verify WalletManager is deployed first

### Issue: MetaMask not connecting
**Solution**:
- Refresh Remix page
- Disconnect and reconnect MetaMask
- Check MetaMask is unlocked
- Verify correct network selected

---

## 📚 NEXT STEPS

After successful deployment:

1. ✅ Update `.env` with contract addresses
2. ✅ Test basic functions in Remix
3. ✅ Deploy Zeno Pay integration
4. ✅ Update Edge Functions with contract addresses
5. ✅ Test end-to-end flows

---

## 🆘 NEED HELP?

Common questions:

**Q: Where do I find USDT on Scroll Sepolia?**
A: You may need to deploy a mock ERC20 token for testing, or use an existing testnet USDT if available.

**Q: How much ETH do I need for deployment?**
A: Approximately 0.01-0.02 ETH for all contracts.

**Q: Can I redeploy if something goes wrong?**
A: Yes! Just deploy again and update the addresses.

**Q: How do I call contract functions from my app?**
A: Use ethers.js with the contract ABI and address. Example in the edge functions.

---

**🎉 DEPLOYMENT COMPLETE!**

You now have:
- ✅ WalletManager contract deployed
- ✅ ChamaFactory contract deployed
- ✅ Contract addresses saved
- ✅ Ready for integration

Next: Zeno Pay integration and Edge Function updates!
