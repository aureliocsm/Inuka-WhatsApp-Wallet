import axios from 'axios';
import { config } from '../config/index.js';

const ZENO_API_KEY = process.env.ZENO_API_KEY;
const ZENO_API_URL = process.env.ZENO_API_URL || 'https://api.zeno.africa';

export function formatTo5Decimals(num) {
  return parseFloat(num.toFixed(5));
}

export async function getExchangeRate(fromToken, toCurrency = 'TZS') {
  try {
    const response = await axios.get(`${ZENO_API_URL}/v1/rates`, {
      headers: {
        'Authorization': `Bearer ${ZENO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      params: {
        from: fromToken,
        to: toCurrency,
      },
    });

    return {
      success: true,
      rate: response.data.rate,
      from: fromToken,
      to: toCurrency,
    };
  } catch (error) {
    console.error('Error fetching exchange rate:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch exchange rate',
    };
  }
}

export async function calculateCryptoAmount(tzsAmount, token) {
  const rateResult = await getExchangeRate(token, 'TZS');

  if (!rateResult.success) {
    return { success: false, error: rateResult.error };
  }

  const cryptoAmount = formatTo5Decimals(tzsAmount / rateResult.rate);

  return {
    success: true,
    cryptoAmount,
    rate: rateResult.rate,
    tzsAmount,
  };
}

export async function calculateTZSAmount(cryptoAmount, token) {
  const rateResult = await getExchangeRate(token, 'TZS');

  if (!rateResult.success) {
    return { success: false, error: rateResult.error };
  }

  const tzsAmount = Math.round(cryptoAmount * rateResult.rate);

  return {
    success: true,
    tzsAmount,
    rate: rateResult.rate,
    cryptoAmount: formatTo5Decimals(cryptoAmount),
  };
}

export async function createDepositOrder(orderId, phoneNumber, tzsAmount, token, webhookUrl) {
  try {
    const response = await axios.post(
      `${ZENO_API_URL}/v1/on-ramp`,
      {
        order_id: orderId,
        phone_number: phoneNumber,
        amount: tzsAmount,
        currency: 'TZS',
        token: token,
        payment_channel: 'MPESA-TZ',
        webhook_url: webhookUrl,
      },
      {
        headers: {
          'Authorization': `Bearer ${ZENO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      orderId,
      phoneNumber,
      tzsAmount,
      token,
    };
  } catch (error) {
    console.error('Error creating deposit order:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to create deposit order',
    };
  }
}

export async function createWithdrawalOrder(orderId, phoneNumber, tzsAmount, token, webhookUrl) {
  try {
    const response = await axios.post(
      `${ZENO_API_URL}/v1/off-ramp`,
      {
        order_id: orderId,
        phone_number: phoneNumber,
        amount: tzsAmount,
        currency: 'TZS',
        token: token,
        payment_channel: 'MPESA-TZ',
        webhook_url: webhookUrl,
      },
      {
        headers: {
          'Authorization': `Bearer ${ZENO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      orderId,
      phoneNumber,
      tzsAmount,
      token,
    };
  } catch (error) {
    console.error('Error creating withdrawal order:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to create withdrawal order',
    };
  }
}

export async function checkOrderStatus(orderId) {
  try {
    const response = await axios.get(`${ZENO_API_URL}/v1/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${ZENO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      status: response.data.status,
      data: response.data,
    };
  } catch (error) {
    console.error('Error checking order status:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to check order status',
    };
  }
}

export function generateOrderId(userId) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `MM-${userId.substring(0, 8)}-${timestamp}-${random}`;
}
