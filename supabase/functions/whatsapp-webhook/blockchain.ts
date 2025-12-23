// blockchain.ts — Complete Chama Integration with all functions

import { ethers } from 'npm:ethers@6.16.0';

// ============================================================================
// CONFIGURATION
// ============================================================================
const RPC_URL = Deno.env.get('SCROLL_SEPOLIA_RPC_URL') || 'https://sepolia-rpc.scroll.io';
const EXPLORER_BASE_URL = Deno.env.get('BLOCKCHAIN_EXPLORER_URL') || 'https://sepolia.scrollscan.com';

const CHAMA_FACTORY_ADDRESS = Deno.env.get('CHAMA_FACTORY_ADDRESS') || '0x305e088651c79CF4e459386e1908c690C0cAa88f';
const TZS_TOKEN_ADDRESS = Deno.env.get('TZS_TOKEN_ADDRESS') || '0x9e47f86a074463f7f51063761f4692AC04770a40';
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

export let provider: ethers.JsonRpcProvider;
export let masterWallet: ethers.Wallet;

export function initializeBlockchain() {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  const pk = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
  if (!pk) throw new Error('MASTER_WALLET_PRIVATE_KEY missing');
  masterWallet = new ethers.Wallet(pk, provider);
  console.log('Blockchain initialized. Master wallet:', masterWallet.address);
}

// ============================================================================
// ABIs
// ============================================================================
const CHAMA_FACTORY_ABI = [
  'function createChama(string memory name, string memory description, string memory inviteCode, uint256 sharePriceUSD, uint256 weeklyMinimum, uint256 loanInterestRate, uint256 lockupMonths) external returns (address)',
  'function getChamaByInviteCode(string) external view returns (address)',
  'function isInviteCodeAvailable(string) external view returns (bool)',
  'event ChamaCreated(address indexed chamaAddress, string inviteCode, address indexed creator, string name)',
];

const CHAMA_ABI = [
  // Member functions
  'function joinChama() external',
  'function contribute(address token, uint256 amount, uint256 amountUSD) external payable',
  'function withdraw(address token, uint256 amount) external',

  // Loan functions
  'function requestLoan(address token, uint256 amount, uint256 durationDays) external returns (uint256)',
  'function voteOnLoan(uint256 loanId, bool approve) external',
  'function disburseLoan(uint256 loanId) external',
  'function repayLoan(uint256 loanId, uint256 amount) external payable',

  // View functions
  'function getMember(address memberAddress) external view returns (tuple(address wallet, uint256 totalContributions, uint256 ethShare, uint256 tzsShare, uint256 sharesOwned, uint256 joinedAt, uint256 lastContribution, uint256 missedContributions, bool isAdmin, bool isActive))',
  'function getLoan(uint256 loanId) external view returns (tuple(address borrower, uint256 amount, address token, uint256 interestRate, uint256 totalDue, uint256 amountRepaid, uint256 requestedAt, uint256 disbursedAt, uint256 dueDate, uint256 approvalsCount, uint256 rejectionsCount, bool isApproved, bool isDisbursed, bool isActive, bool isRepaid))',
  'function hasVotedOnLoan(uint256 loanId, address voter) external view returns (bool, bool)',
  'function getChamaSummary() external view returns (uint256, uint256, uint256, uint256, bool)',
  'function getAllMembers() external view returns (address[])',
  'function isMember(address user) external view returns (bool)',
  'function getRequiredVotes() external view returns (uint256)',

  // State variables
  'function name() external view returns (string)',
  'function description() external view returns (string)',
  'function inviteCode() external view returns (string)',
  'function creator() external view returns (address)',
  'function sharePriceUSD() external view returns (uint256)',
  'function loanInterestRate() external view returns (uint256)',
  'function memberCount() external view returns (uint256)',
  'function isActive() external view returns (bool)',

  // Events
  'event MemberJoined(address indexed member, uint256 timestamp)',
  'event ContributionMade(address indexed member, address indexed token, uint256 amount, uint256 shares)',
  'event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, address token, uint256 durationDays)',
  'event LoanVoted(uint256 indexed loanId, address indexed voter, bool approved)',
  'event LoanApproved(uint256 indexed loanId, uint256 approvalsCount)',
  'event LoanDisbursed(uint256 indexed loanId, address indexed borrower, uint256 amount)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, bool fullyRepaid)',
  'event WithdrawalMade(address indexed member, uint256 amount, address token)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
];

// ============================================================================
// HELPERS
// ============================================================================
export function getExplorerLink(txHash: string): string {
  return `${EXPLORER_BASE_URL}/tx/${txHash}`;
}

export function getAddressExplorerLink(address: string): string {
  return `${EXPLORER_BASE_URL}/address/${address}`;
}

// ============================================================================
// CREATE CHAMA via Factory
// ============================================================================
export async function createChamaOnChain({
  name,
  description,
  inviteCode,
  sharePriceUSD = 10,
  weeklyMinimum = 5,
  loanInterestRate = 5,
  lockupMonths = 3,
  creatorPrivateKey,
}: {
  name: string;
  description: string;
  inviteCode: string;
  sharePriceUSD?: number;
  weeklyMinimum?: number;
  loanInterestRate?: number;
  lockupMonths?: number;
  creatorPrivateKey?: string;
}): Promise<{
  success: boolean;
  chamaAddress?: string;
  txHash?: string;
  explorerLink?: string;
  error?: string;
}> {
  try {
    const wallet = creatorPrivateKey ? new ethers.Wallet(creatorPrivateKey, provider) : masterWallet;
    const factory = new ethers.Contract(CHAMA_FACTORY_ADDRESS, CHAMA_FACTORY_ABI, wallet);

    // Check if invite code is available
    const existing = await factory.getChamaByInviteCode(inviteCode);
    if (existing !== ethers.ZeroAddress) {
      return { success: false, error: `Invite code "${inviteCode}" already used` };
    }

    console.log('Creating Chama:', { name, description, inviteCode });

    // Call factory with individual parameters
    const tx = await factory.createChama(
      name,
      description,
      inviteCode,
      Math.floor(sharePriceUSD * 1e6),  // USD with 6 decimals
      Math.floor(weeklyMinimum * 1e6),  // USD with 6 decimals
      loanInterestRate,
      lockupMonths,
      {
        gasLimit: 4_000_000,
      }
    );

    console.log('Tx sent:', tx.hash);
    const receipt = await tx.wait();

    const event = receipt.logs
      .map(log => {
        try { return factory.interface.parseLog(log); } catch { return null; }
      })
      .find(e => e?.name === 'ChamaCreated');

    if (!event) throw new Error('ChamaCreated event missing');

    return {
      success: true,
      chamaAddress: event.args.chamaAddress,
      txHash: receipt.hash,
      explorerLink: getExplorerLink(receipt.hash),
    };
  } catch (error: any) {
    console.error('createChamaOnChain failed:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Failed to create Chama',
    };
  }
}

// ============================================================================
// JOIN CHAMA
// ============================================================================
export async function joinChamaOnChain(
  chamaAddress: string,
  userPrivateKey?: string
): Promise<{ success: boolean; txHash?: string; explorerLink?: string; error?: string }> {
  try {
    const wallet = userPrivateKey ? new ethers.Wallet(userPrivateKey, provider) : masterWallet;
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);

    const tx = await chama.joinChama({ gasLimit: 300_000 });
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      explorerLink: getExplorerLink(receipt.hash),
    };
  } catch (error: any) {
    console.error('joinChamaOnChain error:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Failed to join Chama',
    };
  }
}

// ============================================================================
// CONTRIBUTE TO CHAMA
// ============================================================================
export async function contributeToChamaOnChain({
  chamaAddress,
  token,
  amount,
  amountUSD,
  userPrivateKey,
}: {
  chamaAddress: string;
  token: 'ETH' | 'TZS';
  amount: string;
  amountUSD: number;
  userPrivateKey?: string;
}): Promise<{ success: boolean; txHash?: string; explorerLink?: string; error?: string }> {
  try {
    if (!userPrivateKey) {
      return { success: false, error: 'User private key required for contributions' };
    }

    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);
    const tokenAddr = token === 'ETH' ? ETH_ADDRESS : TZS_TOKEN_ADDRESS;
    const decimals = token === 'ETH' ? 18 : 6;
    const amountWei = ethers.parseUnits(amount, decimals);
    const amountUSD6 = Math.floor(amountUSD * 1e6);

    console.log('Contributing:', { token, amount, amountUSD, chamaAddress });

    // For TZS, we need to approve first
    if (token === 'TZS') {
      const tzsContract = new ethers.Contract(TZS_TOKEN_ADDRESS, ERC20_ABI, wallet);

      const balance = await tzsContract.balanceOf(wallet.address);
      console.log('User TZS balance:', ethers.formatUnits(balance, 6));

      if (balance < amountWei) {
        return {
          success: false,
          error: `Insufficient TZS balance. Have: ${ethers.formatUnits(balance, 6)}, Need: ${amount}`
        };
      }

      const currentAllowance = await tzsContract.allowance(wallet.address, chamaAddress);
      console.log('Current allowance:', ethers.formatUnits(currentAllowance, 6));

      if (currentAllowance < amountWei) {
        console.log('Approving TZS spend...');
        const approveTx = await tzsContract.approve(chamaAddress, amountWei, {
          gasLimit: 100_000
        });
        await approveTx.wait();
        console.log('TZS approved');
      }

      const tx = await chama.contribute(tokenAddr, amountWei, amountUSD6, {
        gasLimit: 600_000
      });
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        explorerLink: getExplorerLink(receipt.hash)
      };
    } else {
      // ETH contribution
      const balance = await provider.getBalance(wallet.address);
      console.log('User ETH balance:', ethers.formatEther(balance));

      if (balance < amountWei) {
        return {
          success: false,
          error: `Insufficient ETH balance. Have: ${ethers.formatEther(balance)}, Need: ${amount}`
        };
      }

      const tx = await chama.contribute(tokenAddr, amountWei, amountUSD6, {
        value: amountWei,
        gasLimit: 600_000
      });
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        explorerLink: getExplorerLink(receipt.hash)
      };
    }
  } catch (error: any) {
    console.error('Contribution error:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Contribution failed'
    };
  }
}

// ============================================================================
// WITHDRAW FROM CHAMA
// ============================================================================
export async function withdrawFromChamaOnChain({
  chamaAddress,
  token,
  amount,
  userPrivateKey,
}: {
  chamaAddress: string;
  token: 'ETH' | 'TZS';
  amount: string;
  userPrivateKey?: string;
}): Promise<{ success: boolean; txHash?: string; explorerLink?: string; error?: string }> {
  try {
    if (!userPrivateKey) {
      return { success: false, error: 'User private key required for withdrawal' };
    }

    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);
    const tokenAddr = token === 'ETH' ? ETH_ADDRESS : TZS_TOKEN_ADDRESS;
    const decimals = token === 'ETH' ? 18 : 6;
    const amountWei = ethers.parseUnits(amount, decimals);

    console.log('Withdrawing:', { token, amount, chamaAddress });

    const tx = await chama.withdraw(tokenAddr, amountWei, {
      gasLimit: 500_000
    });
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      explorerLink: getExplorerLink(receipt.hash)
    };
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Withdrawal failed'
    };
  }
}

// ============================================================================
// REQUEST LOAN
// ============================================================================
export async function requestLoanOnChain({
  chamaAddress,
  token,
  amount,
  durationDays,
  userPrivateKey,
}: {
  chamaAddress: string;
  token: 'ETH' | 'TZS';
  amount: string;
  durationDays: number;
  userPrivateKey?: string;
}): Promise<{ success: boolean; loanId?: number; txHash?: string; explorerLink?: string; error?: string }> {
  try {
    if (!userPrivateKey) {
      return { success: false, error: 'User private key required for loan request' };
    }

    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);
    const tokenAddr = token === 'ETH' ? ETH_ADDRESS : TZS_TOKEN_ADDRESS;
    const amountWei = ethers.parseUnits(amount, token === 'ETH' ? 18 : 6);

    console.log('Requesting loan:', { token, amount, durationDays });

    const tx = await chama.requestLoan(tokenAddr, amountWei, durationDays, {
      gasLimit: 500_000
    });
    const receipt = await tx.wait();

    const event = receipt.logs
      .map(log => {
        try { return chama.interface.parseLog(log); }
        catch { return null; }
      })
      .find(e => e?.name === 'LoanRequested');

    const loanId = event ? Number(event.args.loanId) : undefined;

    return {
      success: true,
      loanId,
      txHash: receipt.hash,
      explorerLink: getExplorerLink(receipt.hash)
    };
  } catch (error: any) {
    console.error('Loan request error:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Loan request failed'
    };
  }
}

// ============================================================================
// VOTE ON LOAN
// ============================================================================
export async function voteOnLoanOnChain({
  chamaAddress,
  loanId,
  approve,
  userPrivateKey,
}: {
  chamaAddress: string;
  loanId: number;
  approve: boolean;
  userPrivateKey?: string;
}): Promise<{ success: boolean; txHash?: string; explorerLink?: string; error?: string }> {
  try {
    if (!userPrivateKey) {
      return { success: false, error: 'User private key required for voting' };
    }

    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);

    const tx = await chama.voteOnLoan(loanId, approve, { gasLimit: 300_000 });
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      explorerLink: getExplorerLink(receipt.hash)
    };
  } catch (error: any) {
    console.error('Vote error:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Vote failed'
    };
  }
}

// ============================================================================
// DISBURSE LOAN
// ============================================================================
export async function disburseLoanOnChain({
  chamaAddress,
  loanId,
  userPrivateKey,
}: {
  chamaAddress: string;
  loanId: number;
  userPrivateKey?: string;
}): Promise<{ success: boolean; txHash?: string; explorerLink?: string; error?: string }> {
  try {
    if (!userPrivateKey) {
      return { success: false, error: 'User private key required for loan disbursement' };
    }

    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);

    const tx = await chama.disburseLoan(loanId, { gasLimit: 500_000 });
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      explorerLink: getExplorerLink(receipt.hash)
    };
  } catch (error: any) {
    console.error('Disburse loan error:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Loan disbursement failed'
    };
  }
}

// ============================================================================
// REPAY LOAN
// ============================================================================
export async function repayLoanOnChain({
  chamaAddress,
  loanId,
  amount,
  token,
  userPrivateKey,
}: {
  chamaAddress: string;
  loanId: number;
  amount: string;
  token: 'ETH' | 'TZS';
  userPrivateKey?: string;
}): Promise<{ success: boolean; txHash?: string; explorerLink?: string; error?: string }> {
  try {
    if (!userPrivateKey) {
      return { success: false, error: 'User private key required for loan repayment' };
    }

    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, wallet);
    const decimals = token === 'ETH' ? 18 : 6;
    const amountWei = ethers.parseUnits(amount, decimals);

    console.log('Repaying loan:', { loanId, amount, token });

    // For TZS, approve first
    if (token === 'TZS') {
      const tzsContract = new ethers.Contract(TZS_TOKEN_ADDRESS, ERC20_ABI, wallet);

      const balance = await tzsContract.balanceOf(wallet.address);
      if (balance < amountWei) {
        return {
          success: false,
          error: `Insufficient TZS balance. Have: ${ethers.formatUnits(balance, 6)}, Need: ${amount}`
        };
      }

      const currentAllowance = await tzsContract.allowance(wallet.address, chamaAddress);
      if (currentAllowance < amountWei) {
        console.log('Approving TZS for repayment...');
        const approveTx = await tzsContract.approve(chamaAddress, amountWei, {
          gasLimit: 100_000
        });
        await approveTx.wait();
      }

      const tx = await chama.repayLoan(loanId, amountWei, { gasLimit: 500_000 });
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        explorerLink: getExplorerLink(receipt.hash)
      };
    } else {
      // ETH repayment
      const balance = await provider.getBalance(wallet.address);
      if (balance < amountWei) {
        return {
          success: false,
          error: `Insufficient ETH balance. Have: ${ethers.formatEther(balance)}, Need: ${amount}`
        };
      }

      const tx = await chama.repayLoan(loanId, amountWei, {
        value: amountWei,
        gasLimit: 500_000
      });
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        explorerLink: getExplorerLink(receipt.hash)
      };
    }
  } catch (error: any) {
    console.error('Repay loan error:', error);
    return {
      success: false,
      error: error.reason || error.message || 'Loan repayment failed'
    };
  }
}

// ============================================================================
// VIEW FUNCTIONS
// ============================================================================

export async function getChamaSummaryOnChain(chamaAddress: string) {
  try {
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, provider);
    const summary = await chama.getChamaSummary();
    return {
      totalContributions: Number(summary[0]) / 1e6,
      totalETH: ethers.formatEther(summary[1]),
      totalTZS: ethers.formatUnits(summary[2], 6),
      memberCount: Number(summary[3]),
      isActive: summary[4],
    };
  } catch (error) {
    console.error("getChamaSummaryOnChain error:", error);
    return null;
  }
}

export async function getMemberOnChain(chamaAddress: string, memberAddress: string) {
  try {
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, provider);
    const member = await chama.getMember(memberAddress);
    return {
      wallet: member.wallet,
      totalContributions: Number(member.totalContributions) / 1e6,
      ethShare: ethers.formatEther(member.ethShare),
      tzsShare: ethers.formatUnits(member.tzsShare, 6),
      sharesOwned: Number(member.sharesOwned),
      joinedAt: Number(member.joinedAt),
      lastContribution: Number(member.lastContribution),
      isAdmin: member.isAdmin,
      isActive: member.isActive,
    };
  } catch (error) {
    console.error("getMemberOnChain error:", error);
    return null;
  }
}

export async function getLoanOnChain(chamaAddress: string, loanId: number) {
  try {
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, provider);
    const loan = await chama.getLoan(loanId);
    const isETH = loan.token === ETH_ADDRESS;

    return {
      borrower: loan.borrower,
      amount: isETH ? ethers.formatEther(loan.amount) : ethers.formatUnits(loan.amount, 6),
      token: isETH ? 'ETH' : 'TZS',
      interestRate: Number(loan.interestRate),
      totalDue: isETH ? ethers.formatEther(loan.totalDue) : ethers.formatUnits(loan.totalDue, 6),
      amountRepaid: isETH ? ethers.formatEther(loan.amountRepaid) : ethers.formatUnits(loan.amountRepaid, 6),
      requestedAt: Number(loan.requestedAt),
      disbursedAt: Number(loan.disbursedAt),
      dueDate: Number(loan.dueDate),
      approvalsCount: Number(loan.approvalsCount),
      rejectionsCount: Number(loan.rejectionsCount),
      isApproved: loan.isApproved,
      isDisbursed: loan.isDisbursed,
      isActive: loan.isActive,
      isRepaid: loan.isRepaid,
    };
  } catch (error) {
    console.error("getLoanOnChain error:", error);
    return null;
  }
}

export async function isMemberOnChain(chamaAddress: string, userAddress: string): Promise<boolean> {
  try {
    const chama = new ethers.Contract(chamaAddress, CHAMA_ABI, provider);
    return await chama.isMember(userAddress);
  } catch (error) {
    console.error("isMemberOnChain error:", error);
    return false;
  }
}

// ============================================================================
// INITIALIZE
// ============================================================================
try {
  initializeBlockchain();
} catch (err) {
  console.error("Blockchain init failed:", err);
}
