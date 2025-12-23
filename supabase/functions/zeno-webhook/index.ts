import { createClient } from 'npm:@supabase/supabase-js@2.86.2';
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-api-key',
};

const ZENO_API_KEY = Deno.env.get('ZENO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const META_API_URL = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;

/**
 * Send WhatsApp notification
 */
async function sendWhatsAppMessage(to: string, message: string) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    console.error('Meta API not configured');
    return null;
  }

  try {
    const response = await fetch(META_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Format number to 5 decimal places
 */
function formatTo5Decimals(num: number): number {
  return parseFloat(num.toFixed(5));
}

/**
 * Handle completed deposit (on-ramp)
 */
async function handleCompletedDeposit(transaction: any) {
  try {
    console.log('Processing completed deposit:', transaction.order_id);

    const { data: txData, error: txError } = await supabase
      .from('mobile_money_transactions')
      .select('*, users!inner(*)')
      .eq('order_id', transaction.order_id)
      .single();

    if (txError || !txData) {
      console.error('Transaction not found:', transaction.order_id);
      return;
    }

    // Update transaction status
    await supabase
      .from('mobile_money_transactions')
      .update({
        status: 'completed',
        zeno_reference: transaction.reference,
        completed_at: new Date().toISOString(),
        webhook_data: transaction
      })
      .eq('order_id', transaction.order_id);

    // Credit user's wallet
    const tokenSymbol = txData.token_symbol;
    const amountCrypto = formatTo5Decimals(txData.amount_crypto);

    if (tokenSymbol === 'ETH') {
      await supabase.rpc('increment_eth_balance', {
        user_id_param: txData.user_id,
        amount_param: amountCrypto
      });
    } else if (tokenSymbol === 'USDT') {
      await supabase.rpc('increment_usdt_balance', {
        user_id_param: txData.user_id,
        amount_param: amountCrypto
      });
    }

    // Send WhatsApp notification
    const user = txData.users;
    const message = `✅ *Deposit Successful!*\n\n${amountCrypto} ${tokenSymbol} has been added to your wallet.\n\nReference: ${transaction.reference}\n\nType *balance* to view your updated balance.`;

    await sendWhatsAppMessage(user.whatsapp_number, message);

    console.log('✅ Deposit processed successfully:', transaction.order_id);
  } catch (error) {
    console.error('Error processing deposit:', error);
  }
}

/**
 * Handle completed withdrawal (off-ramp)
 */
async function handleCompletedWithdrawal(transaction: any) {
  try {
    console.log('Processing completed withdrawal:', transaction.order_id);

    const { data: txData, error: txError } = await supabase
      .from('mobile_money_transactions')
      .select('*, users!inner(*)')
      .eq('order_id', transaction.order_id)
      .single();

    if (txError || !txData) {
      console.error('Transaction not found:', transaction.order_id);
      return;
    }

    // Update transaction status
    await supabase
      .from('mobile_money_transactions')
      .update({
        status: 'completed',
        zeno_reference: transaction.reference,
        completed_at: new Date().toISOString(),
        webhook_data: transaction
      })
      .eq('order_id', transaction.order_id);

    // Send WhatsApp notification
    const user = txData.users;
    const message = `✅ *Withdrawal Successful!*\n\nTZS ${txData.amount_tzs.toLocaleString()} has been sent to ${txData.phone_number}.\n\nReference: ${transaction.reference}`;

    await sendWhatsAppMessage(user.whatsapp_number, message);

    console.log('✅ Withdrawal processed successfully:', transaction.order_id);
  } catch (error) {
    console.error('Error processing withdrawal:', error);
  }
}

/**
 * Handle failed transaction
 */
async function handleFailedTransaction(orderId: string, error: string) {
  try {
    const { data: txData, error: txError } = await supabase
      .from('mobile_money_transactions')
      .select('*, users!inner(*)')
      .eq('order_id', orderId)
      .single();

    if (txError || !txData) {
      console.error('Transaction not found:', orderId);
      return;
    }

    // Update transaction status
    await supabase
      .from('mobile_money_transactions')
      .update({
        status: 'failed',
        error_message: error,
        completed_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    // If it was a withdrawal, refund the tokens
    if (txData.transaction_type === 'withdraw') {
      const tokenSymbol = txData.token_symbol;
      const amountCrypto = formatTo5Decimals(txData.amount_crypto);

      if (tokenSymbol === 'ETH') {
        await supabase.rpc('increment_eth_balance', {
          user_id_param: txData.user_id,
          amount_param: amountCrypto
        });
      } else if (tokenSymbol === 'USDT') {
        await supabase.rpc('increment_usdt_balance', {
          user_id_param: txData.user_id,
          amount_param: amountCrypto
        });
      }
    }

    // Send WhatsApp notification
    const user = txData.users;
    const txType = txData.transaction_type === 'deposit' ? 'Deposit' : 'Withdrawal';
    const message = `❌ *${txType} Failed*\n\nYour transaction could not be completed.\n\nReason: ${error}\n\nPlease try again or contact support.`;

    await sendWhatsAppMessage(user.whatsapp_number, message);

    console.log('❌ Transaction marked as failed:', orderId);
  } catch (error) {
    console.error('Error handling failed transaction:', error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Verify Zeno Pay API key
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== ZENO_API_KEY) {
      console.error('Invalid API key');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Parse webhook payload
    const payload = await req.json();
    console.log('📨 Zeno Pay webhook received:', payload);

    const orderId = payload.order_id;
    const paymentStatus = payload.payment_status;
    const reference = payload.reference;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing order_id' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Process based on status
    if (paymentStatus === 'COMPLETED') {
      // Determine if this is a deposit or withdrawal
      const { data: txData } = await supabase
        .from('mobile_money_transactions')
        .select('transaction_type')
        .eq('order_id', orderId)
        .single();

      if (txData) {
        if (txData.transaction_type === 'deposit') {
          await handleCompletedDeposit(payload);
        } else if (txData.transaction_type === 'withdraw') {
          await handleCompletedWithdrawal(payload);
        }
      }
    } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
      await handleFailedTransaction(orderId, paymentStatus);
    }

    return new Response(JSON.stringify({ success: true, processed: orderId }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
