import {
  createChama,
  getChamaByInviteCode,
  getChamasByUser,
  getChamaMemberByUserAndChama,
  createChamaMember,
  updateChamaMember,
  updateChama,
  createChamaDeposit,
  getChamaDeposits,
  createChamaLoan,
  getChamaLoans,
  updateChamaLoan,
  createChamaPenalty,
  getChamaPenalties,
  callDatabaseFunction,
  getChamaMembers,
} from '../db/supabase.js';
import { formatTo5Decimals } from './zeno.js';

export async function createNewChama(
  userId,
  name,
  description,
  sharePriceUsd,
  weeklyMinimum,
  loanInterestRate,
  lockupMonths,
  autoInvestmentPercentage
) {
  try {
    const inviteCode = await callDatabaseFunction('generate_invite_code', {});

    const chamaData = {
      name,
      description,
      invite_code: inviteCode,
      creator_id: userId,
      share_price_usd: sharePriceUsd,
      weekly_minimum_contribution: weeklyMinimum,
      loan_interest_rate: loanInterestRate,
      lockup_period_months: lockupMonths,
      auto_investment_percentage: autoInvestmentPercentage,
      status: 'active',
      member_count: 1,
    };

    const chama = await createChama(chamaData);

    const memberData = {
      chama_id: chama.id,
      user_id: userId,
      is_admin: true,
      status: 'active',
    };

    await createChamaMember(memberData);

    return {
      success: true,
      chama,
      inviteCode,
    };
  } catch (error) {
    console.error('Error creating Chama:', error);
    return {
      success: false,
      error: 'Failed to create Chama',
    };
  }
}

export async function joinChama(userId, inviteCode) {
  try {
    const chama = await getChamaByInviteCode(inviteCode);

    if (!chama) {
      return {
        success: false,
        error: 'Invalid invite code',
      };
    }

    if (chama.status !== 'active') {
      return {
        success: false,
        error: 'This Chama is no longer active',
      };
    }

    const existingMember = await getChamaMemberByUserAndChama(userId, chama.id);

    if (existingMember) {
      return {
        success: false,
        error: 'You are already a member of this Chama',
      };
    }

    const memberData = {
      chama_id: chama.id,
      user_id: userId,
      is_admin: false,
      status: 'active',
    };

    const member = await createChamaMember(memberData);

    await updateChama(chama.id, {
      member_count: chama.member_count + 1,
    });

    return {
      success: true,
      chama,
      member,
    };
  } catch (error) {
    console.error('Error joining Chama:', error);
    return {
      success: false,
      error: 'Failed to join Chama',
    };
  }
}

export async function depositToChama(userId, chamaId, tokenSymbol, amountCrypto, amountUsd) {
  try {
    const member = await getChamaMemberByUserAndChama(userId, chamaId);

    if (!member) {
      return {
        success: false,
        error: 'You are not a member of this Chama',
      };
    }

    const formattedAmount = formatTo5Decimals(amountCrypto);

    const decrementSuccess = await decrementUserBalance(userId, formattedAmount, tokenSymbol);

    if (!decrementSuccess) {
      return {
        success: false,
        error: 'Insufficient balance',
      };
    }

    const autoInvestmentPercentage = 10;
    const ethInvestedAmount = formatTo5Decimals((amountUsd * autoInvestmentPercentage) / 100);

    const depositData = {
      chama_id: chamaId,
      member_id: member.id,
      user_id: userId,
      token_symbol: tokenSymbol,
      amount_crypto: formattedAmount,
      amount_usd: amountUsd,
      eth_invested_amount: ethInvestedAmount,
    };

    const deposit = await createChamaDeposit(depositData);

    const newTotalContributions = formatTo5Decimals(member.total_contributions + amountUsd);
    let newEthShare = member.eth_share;
    let newUsdtShare = member.usdt_share;

    if (tokenSymbol === 'ETH') {
      newEthShare = formatTo5Decimals(member.eth_share + formattedAmount);
    } else if (tokenSymbol === 'USDT') {
      newUsdtShare = formatTo5Decimals(member.usdt_share + formattedAmount);
    }

    await updateChamaMember(member.id, {
      total_contributions: newTotalContributions,
      eth_share: newEthShare,
      usdt_share: newUsdtShare,
      last_contribution_date: new Date().toISOString(),
    });

    const chama = await getChamaByInviteCode((await getChamaMembers(chamaId))[0]?.chamas?.invite_code);
    const newChamaTotalContributions = formatTo5Decimals(chama.total_contributions + amountUsd);
    let newChamaEthHoldings = chama.total_eth_holdings;
    let newChamaUsdtHoldings = chama.total_usdt_holdings;

    if (tokenSymbol === 'ETH') {
      newChamaEthHoldings = formatTo5Decimals(chama.total_eth_holdings + formattedAmount);
    } else if (tokenSymbol === 'USDT') {
      newChamaUsdtHoldings = formatTo5Decimals(chama.total_usdt_holdings + formattedAmount);
    }

    await updateChama(chamaId, {
      total_contributions: newChamaTotalContributions,
      total_eth_holdings: newChamaEthHoldings,
      total_usdt_holdings: newChamaUsdtHoldings,
    });

    return {
      success: true,
      deposit,
      ethInvestedAmount,
      member,
    };
  } catch (error) {
    console.error('Error depositing to Chama:', error);
    return {
      success: false,
      error: 'Failed to deposit to Chama',
    };
  }
}

export async function requestChamaLoan(userId, chamaId, loanAmount, tokenSymbol, collateralAmount, collateralToken) {
  try {
    const member = await getChamaMemberByUserAndChama(userId, chamaId);

    if (!member) {
      return {
        success: false,
        error: 'You are not a member of this Chama',
      };
    }

    if (member.status !== 'active') {
      return {
        success: false,
        error: 'Your membership is not active',
      };
    }

    const requiredCollateral = formatTo5Decimals(loanAmount * 1.5);

    if (collateralAmount < requiredCollateral) {
      return {
        success: false,
        error: `Insufficient collateral. Required: ${requiredCollateral} ${collateralToken}`,
      };
    }

    const decrementSuccess = await decrementUserBalance(userId, collateralAmount, collateralToken);

    if (!decrementSuccess) {
      return {
        success: false,
        error: 'Insufficient balance for collateral',
      };
    }

    const interestRate = 5;
    const totalRepayment = formatTo5Decimals(loanAmount * (1 + interestRate / 100));

    const loanData = {
      chama_id: chamaId,
      borrower_id: userId,
      loan_amount: formatTo5Decimals(loanAmount),
      token_symbol: tokenSymbol,
      interest_rate: interestRate,
      total_repayment_due: totalRepayment,
      outstanding_balance: totalRepayment,
      collateral_amount: formatTo5Decimals(collateralAmount),
      collateral_token: collateralToken,
      status: 'active',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const loan = await createChamaLoan(loanData);

    await incrementUserBalance(userId, formatTo5Decimals(loanAmount), tokenSymbol);

    return {
      success: true,
      loan,
      totalRepayment,
      collateralAmount,
    };
  } catch (error) {
    console.error('Error requesting loan:', error);
    return {
      success: false,
      error: 'Failed to request loan',
    };
  }
}

export async function repayChamaLoan(userId, loanId, repaymentAmount) {
  try {
    const loans = await getChamaLoans(null, userId);
    const loan = loans.find((l) => l.id === loanId);

    if (!loan) {
      return {
        success: false,
        error: 'Loan not found',
      };
    }

    if (loan.status !== 'active') {
      return {
        success: false,
        error: 'Loan is not active',
      };
    }

    const formattedAmount = formatTo5Decimals(repaymentAmount);

    if (formattedAmount > loan.outstanding_balance) {
      return {
        success: false,
        error: 'Repayment amount exceeds outstanding balance',
      };
    }

    const decrementSuccess = await decrementUserBalance(userId, formattedAmount, loan.token_symbol);

    if (!decrementSuccess) {
      return {
        success: false,
        error: 'Insufficient balance',
      };
    }

    const newOutstanding = formatTo5Decimals(loan.outstanding_balance - formattedAmount);
    const newAmountRepaid = formatTo5Decimals(loan.amount_repaid + formattedAmount);

    const isFullyRepaid = newOutstanding <= 0.00001;

    await updateChamaLoan(loanId, {
      amount_repaid: newAmountRepaid,
      outstanding_balance: newOutstanding,
      status: isFullyRepaid ? 'repaid' : 'active',
      repaid_at: isFullyRepaid ? new Date().toISOString() : null,
    });

    if (isFullyRepaid) {
      await incrementUserBalance(userId, loan.collateral_amount, loan.collateral_token);
    }

    return {
      success: true,
      newOutstanding,
      isFullyRepaid,
      collateralReturned: isFullyRepaid,
    };
  } catch (error) {
    console.error('Error repaying loan:', error);
    return {
      success: false,
      error: 'Failed to repay loan',
    };
  }
}

export async function getUserChamas(userId) {
  return await getChamasByUser(userId);
}

export async function getChamaDetails(chamaId) {
  const members = await getChamaMembers(chamaId);
  const deposits = await getChamaDeposits(chamaId);
  const loans = await getChamaLoans(chamaId);
  const penalties = await getChamaPenalties(chamaId);

  return {
    members,
    deposits,
    loans,
    penalties,
  };
}

async function decrementUserBalance(userId, amount, tokenSymbol) {
  try {
    if (tokenSymbol === 'ETH') {
      return await callDatabaseFunction('decrement_eth_balance', {
        user_id_param: userId,
        amount_param: amount,
      });
    } else if (tokenSymbol === 'USDT') {
      return await callDatabaseFunction('decrement_usdt_balance', {
        user_id_param: userId,
        amount_param: amount,
      });
    }
    return false;
  } catch (error) {
    console.error('Error decrementing balance:', error);
    return false;
  }
}

async function incrementUserBalance(userId, amount, tokenSymbol) {
  try {
    if (tokenSymbol === 'ETH') {
      await callDatabaseFunction('increment_eth_balance', {
        user_id_param: userId,
        amount_param: amount,
      });
    } else if (tokenSymbol === 'USDT') {
      await callDatabaseFunction('increment_usdt_balance', {
        user_id_param: userId,
        amount_param: amount,
      });
    }
    return true;
  } catch (error) {
    console.error('Error incrementing balance:', error);
    return false;
  }
}
