import { createClient } from 'npm:@supabase/supabase-js@2.86.2';
import { ethers } from 'npm:ethers@6.16.0';
import CryptoJS from 'npm:crypto-js@4.2.0';
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  createChamaOnChain,
  joinChamaOnChain,
  contributeToChamaOnChain,
  requestLoanOnChain,
  voteOnLoanOnChain,
  disburseLoanOnChain,
  repayLoanOnChain,
  withdrawFromChamaOnChain,
  getExplorerLink,
  getAddressExplorerLink,
  getLoanOnChain,
  getMemberOnChain,
} from './blockchain.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Environment variables
const META_WEBHOOK_VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID');
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestCounts = new Map();

function checkRateLimit(phoneNumber: string): boolean {
  const now = Date.now();
  const userKey = `ratelimit:${phoneNumber}`;
  const record = requestCounts.get(userKey);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW) {
    requestCounts.set(userKey, { startTime: now, count: 1 });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW) {
      requestCounts.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

async function sendWhatsAppMessage(to: string, message: string) {
  try {
    const url = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
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
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API error:', error);
      throw new Error(`WhatsApp send failed: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY!).toString();
}

function decrypt(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY!);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function getOrCreateUser(phoneNumber: string) {
  const { data: existingUser, error: getUserError } = await supabase
    .from('users')
    .select('*')
    .eq('phone_number', phoneNumber)
    .maybeSingle();

  if (existingUser) {
    return existingUser;
  }

  const wallet = ethers.Wallet.createRandom();
  const encryptedPrivateKey = encrypt(wallet.privateKey);

  const { data: newUser, error: createUserError } = await supabase
    .from('users')
    .insert({
      phone_number: phoneNumber,
      wallet_address: wallet.address,
      encrypted_private_key: encryptedPrivateKey,
    })
    .select()
    .single();

  if (createUserError) {
    console.error('Error creating user:', createUserError);
    throw createUserError;
  }

  return newUser;
}

async function getUserSession(userId: string) {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error getting session:', error);
    return null;
  }

  return data;
}

async function updateUserSession(userId: string, sessionData: any) {
  const { error } = await supabase
    .from('user_sessions')
    .upsert({
      user_id: userId,
      session_data: sessionData,
      last_activity: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error updating session:', error);
    throw error;
  }
}

async function clearUserSession(userId: string) {
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing session:', error);
  }
}

async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_pins')
    .select('pin_hash')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const pinHash = CryptoJS.SHA256(pin).toString();
  return pinHash === data.pin_hash;
}

async function setPin(userId: string, pin: string) {
  const pinHash = CryptoJS.SHA256(pin).toString();

  const { error } = await supabase
    .from('user_pins')
    .upsert({
      user_id: userId,
      pin_hash: pinHash,
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error setting PIN:', error);
    throw error;
  }
}

async function hasPin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_pins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}

async function getUserChamas(userId: string) {
  const { data, error } = await supabase
    .from('chama_members')
    .select(`
      *,
      chama:chamas(
        id,
        name,
        description,
        invite_code,
        contract_address,
        creator_id,
        created_at
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Error getting user chamas:', error);
    return [];
  }

  return data || [];
}

async function getChamaById(chamaId: string) {
  const { data, error } = await supabase
    .from('chamas')
    .select('*')
    .eq('id', chamaId)
    .single();

  if (error) {
    console.error('Error getting chama:', error);
    return null;
  }

  return data;
}

async function getChamaByInviteCode(inviteCode: string) {
  const { data, error } = await supabase
    .from('chamas')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('Error getting chama by invite code:', error);
    return null;
  }

  return data;
}

async function getChamaMembership(chamaId: string, userId: string) {
  const { data, error } = await supabase
    .from('chama_members')
    .select('*')
    .eq('chama_id', chamaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error getting chama membership:', error);
    return null;
  }

  return data;
}

async function createChama({
  name,
  description,
  inviteCode,
  creatorId,
  contractAddress,
  creationTxHash,
  creationExplorerLink,
}: {
  name: string;
  description: string;
  inviteCode: string;
  creatorId: string;
  contractAddress: string;
  creationTxHash: string;
  creationExplorerLink: string;
}) {
  const { data: chama, error: chamaError } = await supabase
    .from('chamas')
    .insert({
      name,
      description,
      invite_code: inviteCode,
      creator_id: creatorId,
      contract_address: contractAddress,
      creation_tx_hash: creationTxHash,
      creation_explorer_link: creationExplorerLink,
    })
    .select()
    .single();

  if (chamaError) {
    console.error('Error creating chama:', chamaError);
    throw chamaError;
  }

  const { error: memberError } = await supabase
    .from('chama_members')
    .insert({
      chama_id: chama.id,
      user_id: creatorId,
      role: 'admin',
      status: 'active',
    });

  if (memberError) {
    console.error('Error adding creator as member:', memberError);
    throw memberError;
  }

  return chama;
}

async function joinChama(chamaId: string, userId: string) {
  const { data, error } = await supabase
    .from('chama_members')
    .insert({
      chama_id: chamaId,
      user_id: userId,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error joining chama:', error);
    throw error;
  }

  return data;
}

async function recordContribution({
  chamaId,
  userId,
  memberId,
  tokenSymbol,
  amountCrypto,
  amountUsd,
  txHash,
  explorerLink,
}: {
  chamaId: string;
  userId: string;
  memberId: string;
  tokenSymbol: string;
  amountCrypto: number;
  amountUsd: number;
  txHash?: string;
  explorerLink?: string;
}) {
  const { data, error } = await supabase
    .from('chama_contributions')
    .insert({
      chama_id: chamaId,
      user_id: userId,
      member_id: memberId,
      token_symbol: tokenSymbol,
      amount_crypto: amountCrypto,
      amount_usd: amountUsd,
      tx_hash: txHash,
      explorer_link: explorerLink,
      status: txHash ? 'confirmed' : 'pending',
      confirmed_at: txHash ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error recording contribution:', error);
    throw error;
  }

  return data;
}

async function createLoan({
  chamaId,
  borrowerId,
  amount,
  tokenSymbol,
  durationMonths,
  approvalsRequired,
  onChainLoanId,
  txHash,
  explorerLink,
}: {
  chamaId: string;
  borrowerId: string;
  amount: number;
  tokenSymbol: string;
  durationMonths: number;
  approvalsRequired: number;
  onChainLoanId?: number;
  txHash?: string;
  explorerLink?: string;
}) {
  const { data, error } = await supabase
    .from('chama_loans')
    .insert({
      chama_id: chamaId,
      borrower_id: borrowerId,
      amount,
      token_symbol: tokenSymbol,
      duration_months: durationMonths,
      approvals_required: approvalsRequired,
      approvals_received: 0,
      status: 'pending',
      on_chain_loan_id: onChainLoanId,
      tx_hash: txHash,
      explorer_link: explorerLink,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating loan:', error);
    throw error;
  }

  return data;
}

async function getLoanById(loanId: string) {
  const { data, error } = await supabase
    .from('chama_loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (error) {
    console.error('Error getting loan:', error);
    return null;
  }

  return data;
}

async function updateLoan(loanId: string, updates: any) {
  const { data, error } = await supabase
    .from('chama_loans')
    .update(updates)
    .eq('id', loanId)
    .select()
    .single();

  if (error) {
    console.error('Error updating loan:', error);
    throw error;
  }

  return data;
}

async function getChamaMembers(chamaId: string) {
  const { data, error } = await supabase
    .from('chama_members')
    .select(`
      *,
      user:users(
        id,
        phone_number,
        wallet_address
      )
    `)
    .eq('chama_id', chamaId)
    .eq('status', 'active');

  if (error) {
    console.error('Error getting chama members:', error);
    return [];
  }

  return data || [];
}

async function handleMessage(user: any, messageText: string) {
  try {
    const lowerMessage = messageText.toLowerCase().trim();

    if (lowerMessage === 'menu' || lowerMessage === 'start') {
      await clearUserSession(user.id);
      const hasUserPin = await hasPin(user.id);
      
      if (!hasUserPin) {
        await sendWhatsAppMessage(
          user.phone_number,
          '🔒 *Welcome to INUKA Pay*\n\nYou need to set up a PIN first.\n\nPlease enter a 4-digit PIN:'
        );
        await updateUserSession(user.id, { step: 'awaiting_pin_setup' });
        return;
      }

      await sendWhatsAppMessage(
        user.phone_number,
        `👋 *Welcome to INUKA Pay*\n\nYour Wallet: ${user.wallet_address}\n\n*Main Menu:*\n1️⃣ Create Chama\n2️⃣ Join Chama\n3️⃣ My Chamas\n4️⃣ My Wallet\n\nReply with the number to continue.`
      );
      return;
    }

    const session = await getUserSession(user.id);
    const sessionData = session?.session_data || {};

    if (sessionData.step === 'awaiting_pin_setup') {
      if (!/^\d{4}$/.test(messageText)) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid PIN. Please enter exactly 4 digits:');
        return;
      }

      await setPin(user.id, messageText);
      await clearUserSession(user.id);
      await sendWhatsAppMessage(
        user.phone_number,
        '✅ PIN set successfully!\n\nType *menu* to get started.'
      );
      return;
    }

    if (sessionData.step === 'awaiting_create_chama_name') {
      await updateUserSession(user.id, { ...sessionData, chamaName: messageText, step: 'awaiting_create_chama_description' });
      await sendWhatsAppMessage(user.phone_number, '📝 Great! Now enter a description for your Chama:');
      return;
    }

    if (sessionData.step === 'awaiting_create_chama_description') {
      await updateUserSession(user.id, { ...sessionData, chamaDescription: messageText, step: 'awaiting_create_chama_pin' });
      await sendWhatsAppMessage(user.phone_number, '🔒 Enter your PIN to create the Chama:');
      return;
    }

    if (sessionData.step === 'awaiting_create_chama_pin') {
      if (!await verifyPin(user.id, messageText)) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid PIN. Try again:');
        return;
      }

      const inviteCode = generateInviteCode();
      
      await sendWhatsAppMessage(user.phone_number, '⏳ Creating your Chama on the blockchain...');

      const result = await createChamaOnChain({
        name: sessionData.chamaName,
        description: sessionData.chamaDescription,
        inviteCode,
        creatorPrivateKey: decrypt(user.encrypted_private_key),
      });

      if (!result.success) {
        await sendWhatsAppMessage(
          user.phone_number,
          `❌ Failed to create Chama: ${result.error}\n\n_Type *menu* to return home_`
        );
        await clearUserSession(user.id);
        return;
      }

      const chama = await createChama({
        name: sessionData.chamaName,
        description: sessionData.chamaDescription,
        inviteCode,
        creatorId: user.id,
        contractAddress: result.chamaAddress!,
        creationTxHash: result.txHash!,
        creationExplorerLink: result.explorerLink!,
      });

      await clearUserSession(user.id);
      await sendWhatsAppMessage(
        user.phone_number,
        `✅ *Chama Created Successfully!*\n\n📛 Name: ${sessionData.chamaName}\n🔗 Contract: ${result.chamaAddress}\n🎟️ Invite Code: *${inviteCode}*\n\n🔍 View on blockchain:\n${result.explorerLink}\n\nShare the invite code with members to join!\n\n_Type *menu* to return home_`
      );
      return;
    }

    if (sessionData.step === 'awaiting_join_chama_code') {
      const chama = await getChamaByInviteCode(messageText);

      if (!chama) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid invite code. Please try again or type *menu* to cancel.');
        return;
      }

      const existingMember = await getChamaMembership(chama.id, user.id);
      if (existingMember) {
        await clearUserSession(user.id);
        await sendWhatsAppMessage(user.phone_number, '❌ You are already a member of this Chama.\n\n_Type *menu* to return home_');
        return;
      }

      await updateUserSession(user.id, { ...sessionData, chamaId: chama.id, step: 'awaiting_join_chama_pin' });
      await sendWhatsAppMessage(user.phone_number, `🔒 Enter your PIN to join "${chama.name}":`);
      return;
    }

    if (sessionData.step === 'awaiting_join_chama_pin') {
      if (!await verifyPin(user.id, messageText)) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid PIN. Try again:');
        return;
      }

      const chama = await getChamaById(sessionData.chamaId);
      if (!chama) {
        await clearUserSession(user.id);
        await sendWhatsAppMessage(user.phone_number, '❌ Chama not found.\n\n_Type *menu* to return home_');
        return;
      }

      await sendWhatsAppMessage(user.phone_number, '⏳ Joining Chama on blockchain...');

      const result = await joinChamaOnChain(
        chama.contract_address,
        decrypt(user.encrypted_private_key)
      );

      if (!result.success) {
        await sendWhatsAppMessage(
          user.phone_number,
          `❌ Failed to join Chama: ${result.error}\n\n_Type *menu* to return home_`
        );
        await clearUserSession(user.id);
        return;
      }

      await joinChama(chama.id, user.id);
      await clearUserSession(user.id);

      await sendWhatsAppMessage(
        user.phone_number,
        `✅ *Successfully Joined!*\n\n📛 Chama: ${chama.name}\n🔗 Contract: ${chama.contract_address}\n\n🔍 Transaction:\n${result.explorerLink}\n\n_Type *menu* to return home_`
      );
      return;
    }

    if (sessionData.step === 'select_chama_for_contribution') {
      const chamaIndex = parseInt(messageText) - 1;
      const userChamas = await getUserChamas(user.id);

      if (chamaIndex < 0 || chamaIndex >= userChamas.length) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid selection. Please enter a valid number.');
        return;
      }

      const selectedChama = userChamas[chamaIndex].chama;
      await updateUserSession(user.id, {
        ...sessionData,
        selectedChamaId: selectedChama.id,
        step: 'select_token_for_contribution',
      });
      await sendWhatsAppMessage(
        user.phone_number,
        `💰 *Contributing to ${selectedChama.name}*\n\nSelect token:\n1️⃣ ETH\n2️⃣ TZS\n\nReply with 1 or 2:`
      );
      return;
    }

    if (sessionData.step === 'select_token_for_contribution') {
      if (messageText !== '1' && messageText !== '2') {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid selection. Please reply with 1 for ETH or 2 for TZS.');
        return;
      }

      const tokenSymbol = messageText === '1' ? 'ETH' : 'TZS';
      await updateUserSession(user.id, {
        ...sessionData,
        tokenSymbol,
        step: 'awaiting_contribution_amount',
      });
      await sendWhatsAppMessage(
        user.phone_number,
        `💵 Enter the amount in ${tokenSymbol}:\n\nExample: 0.01`
      );
      return;
    }

    if (sessionData.step === 'awaiting_contribution_amount') {
      const amount = parseFloat(messageText);
      if (isNaN(amount) || amount <= 0) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid amount. Please enter a positive number.');
        return;
      }

      await updateUserSession(user.id, {
        ...sessionData,
        amount,
        step: 'awaiting_contribution_pin',
      });
      await sendWhatsAppMessage(
        user.phone_number,
        `🔒 Enter your PIN to contribute ${amount} ${sessionData.tokenSymbol}:`
      );
      return;
    }

    if (sessionData.step === 'awaiting_contribution_pin') {
      if (!await verifyPin(user.id, messageText)) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid PIN. Try again:');
        return;
      }

      const chama = await getChamaById(sessionData.selectedChamaId);
      if (!chama) {
        await clearUserSession(user.id);
        await sendWhatsAppMessage(user.phone_number, '❌ Chama not found.\n\n_Type *menu* to return home_');
        return;
      }

      const membership = await getChamaMembership(chama.id, user.id);
      if (!membership) {
        await clearUserSession(user.id);
        await sendWhatsAppMessage(user.phone_number, '❌ You are not a member of this Chama.\n\n_Type *menu* to return home_');
        return;
      }

      await sendWhatsAppMessage(user.phone_number, '⏳ Processing contribution on blockchain...');

      const usdValue = sessionData.tokenSymbol === 'ETH' ? sessionData.amount * 2000 : sessionData.amount;

      const contributeResult = await contributeToChamaOnChain({
        chamaAddress: chama.contract_address,
        token: sessionData.tokenSymbol,
        amount: sessionData.amount.toString(),
        amountUSD: usdValue,
        userPrivateKey: decrypt(user.encrypted_private_key),
      });

      if (!contributeResult.success) {
        await sendWhatsAppMessage(
          user.phone_number,
          `❌ Blockchain transaction failed: ${contributeResult.error}\n\n_Type *menu* to return home_`
        );
        await clearUserSession(user.id);
        return;
      }

      await recordContribution({
        chamaId: chama.id,
        userId: user.id,
        memberId: membership.id,
        tokenSymbol: sessionData.tokenSymbol,
        amountCrypto: sessionData.amount,
        amountUsd: usdValue,
        txHash: contributeResult.txHash,
        explorerLink: contributeResult.explorerLink,
      });

      await clearUserSession(user.id);
      await sendWhatsAppMessage(
        user.phone_number,
        `✅ *Contribution Successful!*\n\n💰 Amount: ${sessionData.amount} ${sessionData.tokenSymbol}\n📛 Chama: ${chama.name}\n\n🔍 Transaction:\n${contributeResult.explorerLink}\n\n_Type *menu* to return home_`
      );
      return;
    }

    if (sessionData.step === 'select_chama_for_loan') {
      const chamaIndex = parseInt(messageText) - 1;
      const userChamas = await getUserChamas(user.id);

      if (chamaIndex < 0 || chamaIndex >= userChamas.length) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid selection. Please enter a valid number.');
        return;
      }

      const selectedChama = userChamas[chamaIndex].chama;
      await updateUserSession(user.id, {
        ...sessionData,
        selectedChamaId: selectedChama.id,
        step: 'select_token_for_loan',
      });
      await sendWhatsAppMessage(
        user.phone_number,
        `💵 *Loan Request for ${selectedChama.name}*\n\nSelect token:\n1️⃣ ETH\n2️⃣ TZS\n\nReply with 1 or 2:`
      );
      return;
    }

    if (sessionData.step === 'select_token_for_loan') {
      if (messageText !== '1' && messageText !== '2') {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid selection. Please reply with 1 for ETH or 2 for TZS.');
        return;
      }

      const tokenSymbol = messageText === '1' ? 'ETH' : 'TZS';
      await updateUserSession(user.id, {
        ...sessionData,
        tokenSymbol,
        step: 'awaiting_loan_amount',
      });
      await sendWhatsAppMessage(
        user.phone_number,
        `💵 Enter loan amount in ${tokenSymbol}:\n\nExample: 0.5`
      );
      return;
    }

    if (sessionData.step === 'awaiting_loan_amount') {
      const amount = parseFloat(messageText);
      if (isNaN(amount) || amount <= 0) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid amount. Please enter a positive number.');
        return;
      }

      await updateUserSession(user.id, {
        ...sessionData,
        loanAmount: amount,
        step: 'awaiting_loan_duration',
      });
      await sendWhatsAppMessage(
        user.phone_number,
        '📅 Enter loan duration in months:\n\nExample: 6'
      );
      return;
    }

    if (sessionData.step === 'awaiting_loan_duration') {
      const duration = parseInt(messageText);
      if (isNaN(duration) || duration <= 0) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid duration. Please enter a positive number.');
        return;
      }

      await updateUserSession(user.id, {
        ...sessionData,
        loanDuration: duration,
        step: 'awaiting_loan_pin',
      });
      await sendWhatsAppMessage(
        user.phone_number,
        `🔒 Enter your PIN to request a loan of ${sessionData.loanAmount} ${sessionData.tokenSymbol} for ${duration} months:`
      );
      return;
    }

    if (sessionData.step === 'awaiting_loan_pin') {
      if (!await verifyPin(user.id, messageText)) {
        await sendWhatsAppMessage(user.phone_number, '❌ Invalid PIN. Try again:');
        return;
      }

      const chama = await getChamaById(sessionData.selectedChamaId);
      if (!chama) {
        await clearUserSession(user.id);
        await sendWhatsAppMessage(user.phone_number, '❌ Chama not found.\n\n_Type *menu* to return home_');
        return;
      }

      const membership = await getChamaMembership(chama.id, user.id);
      if (!membership) {
        await clearUserSession(user.id);
        await sendWhatsAppMessage(user.phone_number, '❌ You are not a member of this Chama.\n\n_Type *menu* to return home_');
        return;
      }

      await sendWhatsAppMessage(user.phone_number, '⏳ Submitting loan request on blockchain...');

      const members = await getChamaMembers(chama.id);
      const durationDays = sessionData.loanDuration * 30;

      const loanResult = await requestLoanOnChain({
        chamaAddress: chama.contract_address,
        token: sessionData.tokenSymbol,
        amount: sessionData.loanAmount.toString(),
        durationDays,
        userPrivateKey: decrypt(user.encrypted_private_key),
      });

      if (!loanResult.success) {
        await sendWhatsAppMessage(
          user.phone_number,
          `❌ Loan request failed: ${loanResult.error}\n\n_Type *menu* to return home_`
        );
        await clearUserSession(user.id);
        return;
      }

      const approvalsRequired = Math.ceil(members.length * 0.51);
      const loan = await createLoan({
        chamaId: chama.id,
        borrowerId: user.id,
        amount: sessionData.loanAmount,
        tokenSymbol: sessionData.tokenSymbol,
        durationMonths: sessionData.loanDuration,
        approvalsRequired,
        onChainLoanId: loanResult.loanId,
        txHash: loanResult.txHash,
        explorerLink: loanResult.explorerLink,
      });

      for (const member of members) {
        if (member.user_id !== user.id) {
          await sendWhatsAppMessage(
            member.user.phone_number,
            `🗳️ *New Loan Request in ${chama.name}*\n\n💰 Amount: ${sessionData.loanAmount} ${sessionData.tokenSymbol}\n📅 Duration: ${sessionData.loanDuration} months\n👤 Borrower: ${user.wallet_address.substring(0, 10)}...\n\n✅ To approve: Reply *approve_${loan.id}*\n❌ To deny: Reply *deny_${loan.id}*`
          );
        }
      }

      await clearUserSession(user.id);
      await sendWhatsAppMessage(
        user.phone_number,
        `✅ *Loan Request Submitted!*\n\n💰 Amount: ${sessionData.loanAmount} ${sessionData.tokenSymbol}\n📅 Duration: ${sessionData.loanDuration} months\n🗳️ Required approvals: ${approvalsRequired}/${members.length}\n\n🔍 Transaction:\n${loanResult.explorerLink}\n\nMembers will be notified to vote.\n\n_Type *menu* to return home_`
      );
      return;
    }

    if (lowerMessage.startsWith('approve_') || lowerMessage.startsWith('deny_')) {
      const isApproval = lowerMessage.startsWith('approve_');
      const loanId = messageText.substring(isApproval ? 8 : 5);

      await handleLoanVote(user, loanId, isApproval);
      return;
    }

    if (lowerMessage.startsWith('disburse_')) {
      const loanId = messageText.substring(9);
      await handleLoanDisburse(user, loanId);
      return;
    }

    if (lowerMessage === '1') {
      await updateUserSession(user.id, { step: 'awaiting_create_chama_name' });
      await sendWhatsAppMessage(user.phone_number, '📛 Enter a name for your Chama:');
      return;
    }

    if (lowerMessage === '2') {
      await updateUserSession(user.id, { step: 'awaiting_join_chama_code' });
      await sendWhatsAppMessage(user.phone_number, '🎟️ Enter the 8-character invite code:');
      return;
    }

    if (lowerMessage === '3') {
      const userChamas = await getUserChamas(user.id);

      if (userChamas.length === 0) {
        await sendWhatsAppMessage(
          user.phone_number,
          '📭 You have not joined any Chamas yet.\n\n_Type *menu* to return home_'
        );
        return;
      }

      let message = '📋 *Your Chamas:*\n\n';
      userChamas.forEach((membership, index) => {
        message += `${index + 1}. ${membership.chama.name}\n   Code: ${membership.chama.invite_code}\n   Contract: ${membership.chama.contract_address.substring(0, 10)}...\n\n`;
      });
      message += '*Actions:*\n';
      message += 'Reply *contribute* to add funds\n';
      message += 'Reply *loan* to request a loan\n';
      message += '\n_Type *menu* to return home_';

      await sendWhatsAppMessage(user.phone_number, message);
      return;
    }

    if (lowerMessage === '4') {
      await sendWhatsAppMessage(
        user.phone_number,
        `💼 *Your Wallet*\n\n🔑 Address:\n${user.wallet_address}\n\n🔍 View on explorer:\n${getAddressExplorerLink(user.wallet_address)}\n\n_Type *menu* to return home_`
      );
      return;
    }

    if (lowerMessage === 'contribute') {
      const userChamas = await getUserChamas(user.id);

      if (userChamas.length === 0) {
        await sendWhatsAppMessage(
          user.phone_number,
          '📭 You have not joined any Chamas yet.\n\n_Type *menu* to return home_'
        );
        return;
      }

      let message = '📋 *Select a Chama to contribute to:*\n\n';
      userChamas.forEach((membership, index) => {
        message += `${index + 1}. ${membership.chama.name}\n`;
      });
      message += '\nReply with the number:';

      await updateUserSession(user.id, { step: 'select_chama_for_contribution' });
      await sendWhatsAppMessage(user.phone_number, message);
      return;
    }

    if (lowerMessage === 'loan') {
      const userChamas = await getUserChamas(user.id);

      if (userChamas.length === 0) {
        await sendWhatsAppMessage(
          user.phone_number,
          '📭 You have not joined any Chamas yet.\n\n_Type *menu* to return home_'
        );
        return;
      }

      let message = '📋 *Select a Chama to request a loan from:*\n\n';
      userChamas.forEach((membership, index) => {
        message += `${index + 1}. ${membership.chama.name}\n`;
      });
      message += '\nReply with the number:';

      await updateUserSession(user.id, { step: 'select_chama_for_loan' });
      await sendWhatsAppMessage(user.phone_number, message);
      return;
    }

    await sendWhatsAppMessage(
      user.phone_number,
      '❓ I did not understand that. Type *menu* to see available options.'
    );
  } catch (error) {
    console.error('Error handling message:', error);
    await sendWhatsAppMessage(
      user.phone_number,
      '❌ An error occurred. Please try again or type *menu* to return home.'
    );
  }
}

async function handleLoanVote(user: any, loanId: string, approve: boolean) {
  try {
    const loan = await getLoanById(loanId);
    if (!loan) {
      await sendWhatsAppMessage(user.phone_number, '❌ Loan not found.');
      return;
    }

    if (loan.status !== 'pending') {
      await sendWhatsAppMessage(user.phone_number, `❌ This loan is already ${loan.status}.`);
      return;
    }

    if (loan.borrower_id === user.id) {
      await sendWhatsAppMessage(user.phone_number, '❌ You cannot vote on your own loan.');
      return;
    }

    const membership = await getChamaMembership(loan.chama_id, user.id);
    if (!membership) {
      await sendWhatsAppMessage(user.phone_number, '❌ You are not a member of this Chama.');
      return;
    }

    const chama = await getChamaById(loan.chama_id);
    if (!chama) {
      await sendWhatsAppMessage(user.phone_number, '❌ Chama not found.');
      return;
    }

    await sendWhatsAppMessage(user.phone_number, '⏳ Submitting vote on blockchain...');

    const voteResult = await voteOnLoanOnChain({
      chamaAddress: chama.contract_address,
      loanId: loan.on_chain_loan_id || 0,
      approve: approve,
      userPrivateKey: decrypt(user.encrypted_private_key),
    });

    if (!voteResult.success) {
      await sendWhatsAppMessage(
        user.phone_number,
        `❌ Vote failed: ${voteResult.error}\n\n_Type *menu* to return home_`
      );
      return;
    }

    const newApprovals = approve ? loan.approvals_received + 1 : loan.approvals_received;
    await updateLoan(loan.id, {
      approvals_received: newApprovals,
    });

    const voteEmoji = approve ? '✅' : '❌';
    await sendWhatsAppMessage(
      user.phone_number,
      `${voteEmoji} *Vote Recorded!*\n\n🗳️ Status: ${newApprovals}/${loan.approvals_required} approvals\n\n🔍 Transaction:\n${voteResult.explorerLink}\n\n_Type *menu* to return home_`
    );

    if (newApprovals >= loan.approvals_required) {
      await updateLoan(loan.id, { status: 'approved' });

      const borrower = await supabase
        .from('users')
        .select('*')
        .eq('id', loan.borrower_id)
        .single();

      if (borrower.data) {
        await sendWhatsAppMessage(
          borrower.data.phone_number,
          `✅ *Loan Approved!*\n\n💰 Amount: ${loan.amount} ${loan.token_symbol}\n🗳️ Votes: ${newApprovals}/${loan.approvals_required}\n\nTo receive funds, reply: *disburse_${loan.id}*`
        );
      }
    }
  } catch (error) {
    console.error('Error handling loan vote:', error);
    await sendWhatsAppMessage(
      user.phone_number,
      '❌ Failed to process vote. Please try again.\n\n_Type *menu* to return home_'
    );
  }
}

async function handleLoanDisburse(user: any, loanId: string) {
  try {
    const loan = await getLoanById(loanId);
    if (!loan) {
      await sendWhatsAppMessage(user.phone_number, '❌ Loan not found.');
      return;
    }

    if (loan.borrower_id !== user.id) {
      await sendWhatsAppMessage(user.phone_number, '❌ Only the borrower can disburse the loan.');
      return;
    }

    if (loan.status !== 'approved') {
      await sendWhatsAppMessage(user.phone_number, `❌ This loan is ${loan.status}, not approved yet.`);
      return;
    }

    const chama = await getChamaById(loan.chama_id);
    if (!chama) {
      await sendWhatsAppMessage(user.phone_number, '❌ Chama not found.');
      return;
    }

    await sendWhatsAppMessage(user.phone_number, '⏳ Disbursing loan on blockchain...');

    const disburseResult = await disburseLoanOnChain({
      chamaAddress: chama.contract_address,
      loanId: loan.on_chain_loan_id || 0,
      userPrivateKey: decrypt(user.encrypted_private_key),
    });

    if (!disburseResult.success) {
      await sendWhatsAppMessage(
        user.phone_number,
        `❌ Disbursement failed: ${disburseResult.error}\n\n_Type *menu* to return home_`
      );
      return;
    }

    await updateLoan(loan.id, {
      status: 'active',
      disbursement_tx_hash: disburseResult.txHash,
    });

    await sendWhatsAppMessage(
      user.phone_number,
      `✅ *Loan Disbursed!*\n\n💰 Amount: ${loan.amount} ${loan.token_symbol}\n📅 Duration: ${loan.duration_months} months\n\n🔍 Transaction:\n${disburseResult.explorerLink}\n\nFunds have been transferred to your wallet.\n\n_Type *menu* to return home_`
    );
  } catch (error) {
    console.error('Error disbursing loan:', error);
    await sendWhatsAppMessage(
      user.phone_number,
      '❌ Failed to disburse loan. Please try again.\n\n_Type *menu* to return home_'
    );
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
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN) {
        console.log('Webhook verified');
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return new Response('Forbidden', { status: 403 });
    }

    if (req.method === 'POST') {
      const body = await req.json();

      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const messages = change.value?.messages || [];

              for (const message of messages) {
                const from = message.from;
                const messageText = message.text?.body;

                if (!messageText) continue;

                if (!checkRateLimit(from)) {
                  await sendWhatsAppMessage(
                    from,
                    '⚠️ Rate limit exceeded. Please wait a moment before sending more messages.'
                  );
                  continue;
                }

                const user = await getOrCreateUser(from);
                await handleMessage(user, messageText);
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});