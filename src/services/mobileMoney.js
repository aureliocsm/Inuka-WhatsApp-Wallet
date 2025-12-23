import {
  createMobileMoneyTransaction,
  updateMobileMoneyTransaction,
  getMobileMoneyTransactionByOrderId,
  callDatabaseFunction,
} from '../db/supabase.js';
import {
  generateOrderId,
  createDepositOrder,
  createWithdrawalOrder,
  calculateCryptoAmount,
  calculateTZSAmount,
  formatTo5Decimals,
} from './zeno.js';

const WEBHOOK_URL = process.env.VITE_SUPABASE_URL
  ? `${process.env.VITE_SUPABASE_URL}/functions/v1/zeno-webhook`
  : 'https://ywillrudslflezumhrvz.supabase.co/functions/v1/zeno-webhook';

export async function initiateDeposit(userId, phoneNumber, tzsAmount, tokenSymbol) {
  try {
    const calculation = await calculateCryptoAmount(tzsAmount, tokenSymbol);

    if (!calculation.success) {
      return {
        success: false,
        error: calculation.error,
      };
    }

    const orderId = generateOrderId(userId);
    const cryptoAmount = formatTo5Decimals(calculation.cryptoAmount);

    const txData = {
      user_id: userId,
      order_id: orderId,
      transaction_type: 'deposit',
      token_symbol: tokenSymbol,
      amount_tzs: tzsAmount,
      amount_crypto: cryptoAmount,
      phone_number: phoneNumber,
      payment_channel: 'MPESA-TZ',
      status: 'pending',
    };

    const transaction = await createMobileMoneyTransaction(txData);

    const zenoResult = await createDepositOrder(orderId, phoneNumber, tzsAmount, tokenSymbol, WEBHOOK_URL);

    if (!zenoResult.success) {
      await updateMobileMoneyTransaction(transaction.id, {
        status: 'failed',
        error_message: zenoResult.error,
      });

      return {
        success: false,
        error: zenoResult.error,
      };
    }

    return {
      success: true,
      transaction,
      orderId,
      phoneNumber,
      tzsAmount,
      cryptoAmount,
      rate: calculation.rate,
      tokenSymbol,
    };
  } catch (error) {
    console.error('Error initiating deposit:', error);
    return {
      success: false,
      error: 'Failed to initiate deposit',
    };
  }
}

export async function initiateWithdrawal(userId, phoneNumber, cryptoAmount, tokenSymbol, userBalance) {
  try {
    const formattedAmount = formatTo5Decimals(cryptoAmount);

    if (formattedAmount > userBalance) {
      return {
        success: false,
        error: 'Insufficient balance',
      };
    }

    const calculation = await calculateTZSAmount(formattedAmount, tokenSymbol);

    if (!calculation.success) {
      return {
        success: false,
        error: calculation.error,
      };
    }

    const decrementSuccess = await decrementUserBalance(userId, formattedAmount, tokenSymbol);

    if (!decrementSuccess) {
      return {
        success: false,
        error: 'Failed to deduct balance',
      };
    }

    const orderId = generateOrderId(userId);

    const txData = {
      user_id: userId,
      order_id: orderId,
      transaction_type: 'withdraw',
      token_symbol: tokenSymbol,
      amount_tzs: calculation.tzsAmount,
      amount_crypto: formattedAmount,
      phone_number: phoneNumber,
      payment_channel: 'MPESA-TZ',
      status: 'pending',
    };

    const transaction = await createMobileMoneyTransaction(txData);

    const zenoResult = await createWithdrawalOrder(
      orderId,
      phoneNumber,
      calculation.tzsAmount,
      tokenSymbol,
      WEBHOOK_URL
    );

    if (!zenoResult.success) {
      await updateMobileMoneyTransaction(transaction.id, {
        status: 'failed',
        error_message: zenoResult.error,
      });

      await incrementUserBalance(userId, formattedAmount, tokenSymbol);

      return {
        success: false,
        error: zenoResult.error,
      };
    }

    return {
      success: true,
      transaction,
      orderId,
      phoneNumber,
      tzsAmount: calculation.tzsAmount,
      cryptoAmount: formattedAmount,
      rate: calculation.rate,
      tokenSymbol,
    };
  } catch (error) {
    console.error('Error initiating withdrawal:', error);
    return {
      success: false,
      error: 'Failed to initiate withdrawal',
    };
  }
}

async function decrementUserBalance(userId, amount, tokenSymbol) {
  try {
    if (tokenSymbol === 'ETH') {
      const result = await callDatabaseFunction('decrement_eth_balance', {
        user_id_param: userId,
        amount_param: amount,
      });
      return result;
    } else if (tokenSymbol === 'USDT') {
      const result = await callDatabaseFunction('decrement_usdt_balance', {
        user_id_param: userId,
        amount_param: amount,
      });
      return result;
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

export async function getMobileMoneyTransaction(orderId) {
  return await getMobileMoneyTransactionByOrderId(orderId);
}
