# Smart Contract Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying and configuring the INUKA Pay smart contracts on Scroll Sepolia testnet.

## Smart Contract Architecture

### 1. Chama Contract

**Purpose**: Manages group savings pools with multi-currency support (ETH and TZS tokens).

**Key Features**:
- Member management (join, contribute, withdraw)
- Multi-currency tracking (ETH and TZS pools)
- Lockup period enforcement
- Share-based ownership calculation
- Admin controls

**How It Works**:
1. Members join a chama by calling `joinChama()`
2. Members contribute ETH or TZS tokens using `contribute()`
3. Contributions are tracked per member and pooled
4. Members earn shares based on USD value contributed
5. After lockup period, members can withdraw their share

### 2. Loan Contract (Integrated in Chama)

**Purpose**: Enables members to borrow from the chama pool with democratic approval.

**Key Features**:
- Loan request system
- Democratic voting mechanism (51% approval required)
- Automatic approval when threshold met
- Secure disbursement
- Interest calculation
- Repayment tracking

**How It Works**:
1. Member requests loan using `requestLoan()`
2. Other members vote using `voteOnLoan()`
3. When 51% vote yes, loan is automatically approved
4. Borrower disburses loan using `disburseLoan()`
5. Funds transfer to borrower
6. Borrower repays using `repayLoan()`
7. Repayments increase pool liquidity

### 3. ChamaFactory Contract

**Purpose**: Creates and manages multiple chama instances.

**Key Features**:
- Deploy new chamas
- Registry of all chamas
- Invite code management
- Central configuration

**How It Works**:
1. User creates chama through factory
2. Factory deploys new Chama contract
3. Factory maintains registry
4. Users can find chamas by invite code

## Prerequisites

### Tools Required

1. **Node.js** (v18 or higher)
   ```bash
   node --version
   ```

2. **Hardhat** (Smart contract development framework)
   ```bash
   npm install --save-dev hardhat
   ```

3. **Ethers.js** (v6.16.0)
   ```bash
   npm install ethers@6.16.0
   ```

### Accounts & Credentials

1. **Wallet with Test ETH**
   - Create MetaMask wallet
   - Get Scroll Sepolia ETH from faucet: https://sepolia.scroll.io/faucet

2. **Alchemy Account** (for RPC access)
   - Sign up: https://www.alchemy.com/
   - Create new app for Scroll Sepolia
   - Get API key

3. **Private Keys** (KEEP SECURE)
   - Export private key from MetaMask
   - Never commit to git
   - Store in `.env` file

## Step-by-Step Deployment

### Step 1: Setup Project

```bash
# Navigate to project directory
cd /path/to/project

# Install dependencies
npm install

# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Initialize Hardhat (if not already)
npx hardhat init
```

### Step 2: Configure Hardhat

Create `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    scrollSepolia: {
      url: process.env.ALCHEMY_API_KEY
        ? `https://scroll-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://sepolia-rpc.scroll.io",
      chainId: 534351,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      scrollSepolia: process.env.SCROLLSCAN_API_KEY || "abc"
    },
    customChains: [
      {
        network: "scrollSepolia",
        chainId: 534351,
        urls: {
          apiURL: "https://api-sepolia.scrollscan.com/api",
          browserURL: "https://sepolia.scrollscan.com"
        }
      }
    ]
  }
};
```

### Step 3: Create Deployment Scripts

Create `scripts/deploy-chama-system.js`:

```javascript
const hre = require("hardhat");

async function main() {
  console.log("Deploying INUKA Pay Chama System...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Configuration
  const TZS_TOKEN_ADDRESS = "0x9e47f86a074463f7f51063761f4692AC04770a40";
  const WALLET_MANAGER_ADDRESS = deployer.address; // Can be changed later

  console.log("\n1. Deploying ChamaFactory...");
  const ChamaFactory = await hre.ethers.getContractFactory("ChamaFactory");
  const chamaFactory = await ChamaFactory.deploy(
    WALLET_MANAGER_ADDRESS,
    TZS_TOKEN_ADDRESS
  );
  await chamaFactory.waitForDeployment();
  const factoryAddress = await chamaFactory.getAddress();
  console.log("✓ ChamaFactory deployed to:", factoryAddress);

  console.log("\n2. Creating test Chama...");
  const tx = await chamaFactory.createChama(
    "Test Chama",
    "A test chama for INUKA Pay",
    "TEST1234", // 8-character invite code
    hre.ethers.parseUnits("1", 6), // $1 per share (6 decimals)
    hre.ethers.parseUnits("10", 6), // $10 weekly minimum
    5, // 5% interest rate
    3 // 3 months lockup
  );
  const receipt = await tx.wait();
  console.log("✓ Test Chama created");

  // Get the created chama address from event
  const chamaAddress = await chamaFactory.chamaByInviteCode("TEST1234");
  console.log("✓ Test Chama address:", chamaAddress);

  console.log("\n==============================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("==============================================");
  console.log("Network: Scroll Sepolia");
  console.log("ChamaFactory:", factoryAddress);
  console.log("Test Chama:", chamaAddress);
  console.log("TZS Token:", TZS_TOKEN_ADDRESS);
  console.log("==============================================");

  console.log("\n📝 Save these addresses to your .env file:");
  console.log(`CHAMA_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`TEST_CHAMA_ADDRESS=${chamaAddress}`);

  console.log("\n🔍 Verify contracts:");
  console.log(`npx hardhat verify --network scrollSepolia ${factoryAddress} "${WALLET_MANAGER_ADDRESS}" "${TZS_TOKEN_ADDRESS}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Step 4: Deploy Contracts

```bash
# Deploy to Scroll Sepolia
npx hardhat run scripts/deploy-chama-system.js --network scrollSepolia
```

Expected output:
```
Deploying INUKA Pay Chama System...
Deploying with account: 0x1234...
Account balance: 0.5 ETH

1. Deploying ChamaFactory...
✓ ChamaFactory deployed to: 0xABC...

2. Creating test Chama...
✓ Test Chama created
✓ Test Chama address: 0xDEF...

==============================================
DEPLOYMENT SUMMARY
==============================================
Network: Scroll Sepolia
ChamaFactory: 0xABC...
Test Chama: 0xDEF...
TZS Token: 0x9e47f86a074463f7f51063761f4692AC04770a40
==============================================
```

### Step 5: Verify Contracts (Optional but Recommended)

```bash
# Verify ChamaFactory
npx hardhat verify --network scrollSepolia <FACTORY_ADDRESS> "<WALLET_MANAGER>" "<TZS_TOKEN>"

# Verify Chama (requires constructor args)
npx hardhat verify --network scrollSepolia <CHAMA_ADDRESS> \
  "Test Chama" \
  "A test chama for INUKA Pay" \
  "TEST1234" \
  "<CREATOR_ADDRESS>" \
  "<WALLET_MANAGER>" \
  "<TZS_TOKEN>" \
  "1000000" \
  "10000000" \
  "5" \
  "3"
```

### Step 6: Update Environment Variables

Add to your `.env` file:

```bash
# Smart Contract Addresses
CHAMA_FACTORY_ADDRESS=0x...
TEST_CHAMA_ADDRESS=0x...

# Existing variables
ALCHEMY_API_KEY=your_alchemy_key
DEPLOYER_PRIVATE_KEY=your_private_key
```

### Step 7: Update Webhook Integration

Update `src/services/chama.js` (or create if doesn't exist):

```javascript
import { ethers } from 'ethers';
import { getProvider } from './wallet.js';

const CHAMA_FACTORY_ADDRESS = process.env.CHAMA_FACTORY_ADDRESS;
const TZS_TOKEN_ADDRESS = process.env.TZS_TOKEN_ADDRESS;

const CHAMA_FACTORY_ABI = [
  'function createChama(string name, string description, string inviteCode, uint256 sharePriceUSD, uint256 weeklyMinimum, uint256 loanInterestRate, uint256 lockupMonths) returns (address)',
  'function getChamaByInviteCode(string inviteCode) view returns (address)',
  'function chamaByInviteCode(string) view returns (address)'
];

const CHAMA_ABI = [
  'function joinChama()',
  'function contribute(address token, uint256 amount, uint256 amountUSD) payable',
  'function requestLoan(address token, uint256 amount, uint256 durationDays) returns (uint256)',
  'function voteOnLoan(uint256 loanId, bool approve)',
  'function disburseLoan(uint256 loanId)',
  'function repayLoan(uint256 loanId, uint256 amount) payable',
  'function getMember(address) view returns (tuple(address wallet, uint256 totalContributions, uint256 ethShare, uint256 tzsShare, uint256 sharesOwned, uint256 joinedAt, uint256 lastContribution, uint256 missedContributions, bool isAdmin, bool isActive))',
  'function getLoan(uint256) view returns (tuple(address borrower, uint256 amount, address token, uint256 interestRate, uint256 totalDue, uint256 amountRepaid, uint256 requestedAt, uint256 disbursedAt, uint256 dueDate, uint256 approvalsCount, uint256 rejectionsCount, bool isApproved, bool isDisbursed, bool isActive, bool isRepaid))',
  'function isMember(address) view returns (bool)'
];

export async function createChamaOnChain(wallet, name, description, inviteCode) {
  const factory = new ethers.Contract(CHAMA_FACTORY_ADDRESS, CHAMA_FACTORY_ABI, wallet);

  const tx = await factory.createChama(
    name,
    description,
    inviteCode,
    ethers.parseUnits('1', 6), // $1 per share
    ethers.parseUnits('10', 6), // $10 weekly min
    5, // 5% interest
    3 // 3 months lockup
  );

  const receipt = await tx.wait();
  const chamaAddress = await factory.getChamaByInviteCode(inviteCode);

  return {
    chamaAddress,
    txHash: receipt.hash
  };
}

export async function joinChamaOnChain(wallet, chamaAddress) {
  const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);
  const tx = await chama.joinChama();
  await tx.wait();
  return tx.hash;
}

export async function contributeToChamaOnChain(wallet, chamaAddress, tokenSymbol, amount, amountUSD) {
  const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);

  const token = tokenSymbol === 'ETH'
    ? ethers.ZeroAddress
    : TZS_TOKEN_ADDRESS;

  const value = tokenSymbol === 'ETH' ? ethers.parseEther(amount) : 0;

  const tx = await chama.contribute(
    token,
    tokenSymbol === 'ETH' ? ethers.parseEther(amount) : ethers.parseUnits(amount, 6),
    ethers.parseUnits(amountUSD.toString(), 6),
    { value }
  );

  await tx.wait();
  return tx.hash;
}

export async function requestLoanOnChain(wallet, chamaAddress, tokenSymbol, amount, durationDays) {
  const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);

  const token = tokenSymbol === 'ETH'
    ? ethers.ZeroAddress
    : TZS_TOKEN_ADDRESS;

  const tx = await chama.requestLoan(
    token,
    tokenSymbol === 'ETH' ? ethers.parseEther(amount) : ethers.parseUnits(amount, 6),
    durationDays
  );

  const receipt = await tx.wait();
  return {
    txHash: receipt.hash,
    loanId: receipt.logs[0].args[0] // Assuming first event arg is loanId
  };
}

export async function voteOnLoanOnChain(wallet, chamaAddress, loanId, approve) {
  const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);
  const tx = await chama.voteOnLoan(loanId, approve);
  await tx.wait();
  return tx.hash;
}
```

## Testing the Deployment

### Test 1: Create Chama

```bash
# Using Hardhat console
npx hardhat console --network scrollSepolia

> const factory = await ethers.getContractAt("ChamaFactory", "YOUR_FACTORY_ADDRESS")
> const tx = await factory.createChama("My Chama", "Test", "ABCD1234", ethers.parseUnits("1", 6), ethers.parseUnits("10", 6), 5, 3)
> await tx.wait()
> const chamaAddr = await factory.getChamaByInviteCode("ABCD1234")
> console.log("Chama created at:", chamaAddr)
```

### Test 2: Join Chama

```bash
> const chama = await ethers.getContractAt("Chama", chamaAddr)
> const tx = await chama.joinChama()
> await tx.wait()
> const isMember = await chama.isMember(await ethers.getSigner().getAddress())
> console.log("Is member:", isMember)
```

### Test 3: Contribute ETH

```bash
> const tx = await chama.contribute(
    ethers.ZeroAddress,
    ethers.parseEther("0.001"),
    ethers.parseUnits("2", 6),
    { value: ethers.parseEther("0.001") }
  )
> await tx.wait()
> const member = await chama.getMember(await ethers.getSigner().getAddress())
> console.log("ETH Share:", ethers.formatEther(member.ethShare))
```

## Security Considerations

1. **Private Keys**: Never expose private keys. Use environment variables.
2. **Testnet First**: Always test on testnet before mainnet.
3. **Audit**: Consider smart contract audit for production.
4. **Access Control**: Ensure only authorized addresses can perform admin functions.
5. **Gas Limits**: Monitor gas costs and optimize if needed.
6. **Upgradability**: Consider using upgradeable proxy patterns for future updates.

## Troubleshooting

### Issue: "Insufficient funds"
**Solution**: Get more test ETH from faucet or check balance.

### Issue: "Nonce too high"
**Solution**: Reset MetaMask account or wait for pending transactions.

### Issue: "Contract deployment failed"
**Solution**: Check Solidity version matches (0.8.20), verify all imports.

### Issue: "Transaction reverted"
**Solution**: Check require statements, ensure sufficient allowances for TZS token.

### Issue: "Cannot find module"
**Solution**: Run `npm install` to install all dependencies.

## Next Steps

1. **Deploy WalletManager** (if needed for additional security)
2. **Setup monitoring** for contract events
3. **Create admin dashboard** for managing chamas
4. **Implement automated voting notifications**
5. **Add analytics** for loan performance

## Support

For issues or questions:
- Check Scroll Sepolia explorer: https://sepolia.scrollscan.com
- Review contract code in `/contracts` directory
- Check logs in deployment scripts

## Appendix: Smart Contract ABIs

### ChamaFactory ABI
See `/contracts/ChamaFactory.sol` for full interface

### Chama ABI
See `/contracts/Chama.sol` for full interface

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Network**: Scroll Sepolia Testnet
