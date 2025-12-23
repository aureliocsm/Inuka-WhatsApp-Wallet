import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

export async function getUserByWhatsApp(whatsappNumber) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createUser(userData) {
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUser(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTransaction(txData) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([txData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(txHash, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('tx_hash', txHash)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTransactionsByUser(userId, limit = 10) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function updateBalance(userId, tokenAddress, balance) {
  const { data, error } = await supabase
    .from('wallet_balances')
    .upsert([
      {
        user_id: userId,
        token_address: tokenAddress,
        balance: balance.toString(),
        last_updated: new Date().toISOString(),
      },
    ], {
      onConflict: 'user_id,token_address',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBalances(userId) {
  const { data, error } = await supabase
    .from('wallet_balances')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data;
}

export async function createSession(sessionData) {
  const { data, error } = await supabase
    .from('message_sessions')
    .insert([sessionData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getActiveSession(userId) {
  const { data, error } = await supabase
    .from('message_sessions')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateSession(sessionId, updates) {
  const { data, error } = await supabase
    .from('message_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSession(sessionId) {
  const { error } = await supabase
    .from('message_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}

export async function logAudit(auditData) {
  const { error } = await supabase
    .from('audit_logs')
    .insert([auditData]);

  if (error) throw error;
}

export async function createUserPin(pinData) {
  const { data, error } = await supabase
    .from('user_pins')
    .insert([pinData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserPin(userId) {
  const { data, error } = await supabase
    .from('user_pins')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateUserPin(userId, updates) {
  const { data, error } = await supabase
    .from('user_pins')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function incrementPinFailedAttempts(userId) {
  const pinData = await getUserPin(userId);

  if (!pinData) return null;

  const newFailedAttempts = pinData.failed_attempts + 1;
  const updates = {
    failed_attempts: newFailedAttempts,
  };

  if (newFailedAttempts >= 3) {
    updates.locked_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }

  return updateUserPin(userId, updates);
}

export async function resetPinFailedAttempts(userId) {
  return updateUserPin(userId, {
    failed_attempts: 0,
    locked_until: null,
  });
}

export async function createMobileMoneyTransaction(txData) {
  const { data, error } = await supabase
    .from('mobile_money_transactions')
    .insert([txData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMobileMoneyTransaction(txId, updates) {
  const { data, error } = await supabase
    .from('mobile_money_transactions')
    .update(updates)
    .eq('id', txId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMobileMoneyTransactionByOrderId(orderId) {
  const { data, error } = await supabase
    .from('mobile_money_transactions')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMobileMoneyTransactionsByUser(userId, limit = 10) {
  const { data, error } = await supabase
    .from('mobile_money_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function createChama(chamaData) {
  const { data, error } = await supabase
    .from('chamas')
    .insert([chamaData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChamaById(chamaId) {
  const { data, error } = await supabase
    .from('chamas')
    .select('*')
    .eq('id', chamaId)
    .single();

  if (error) throw error;
  return data;
}

export async function getChamaByInviteCode(inviteCode) {
  const { data, error } = await supabase
    .from('chamas')
    .select('*')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateChama(chamaId, updates) {
  const { data, error } = await supabase
    .from('chamas')
    .update(updates)
    .eq('id', chamaId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChamasByUser(userId) {
  const { data, error } = await supabase
    .from('chama_members')
    .select('*, chamas(*)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw error;
  return data;
}

export async function createChamaMember(memberData) {
  const { data, error } = await supabase
    .from('chama_members')
    .insert([memberData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChamaMemberByUserAndChama(userId, chamaId) {
  const { data, error } = await supabase
    .from('chama_members')
    .select('*')
    .eq('user_id', userId)
    .eq('chama_id', chamaId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getChamaMembers(chamaId) {
  const { data, error } = await supabase
    .from('chama_members')
    .select('*, users(*), chamas(*)')
    .eq('chama_id', chamaId);

  if (error) throw error;
  return data;
}

export async function updateChamaMember(memberId, updates) {
  const { data, error } = await supabase
    .from('chama_members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createChamaDeposit(depositData) {
  const { data, error } = await supabase
    .from('chama_deposits')
    .insert([depositData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChamaDeposits(chamaId, userId = null) {
  let query = supabase
    .from('chama_deposits')
    .select('*, users(whatsapp_number)')
    .eq('chama_id', chamaId)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function createChamaLoan(loanData) {
  const { data, error } = await supabase
    .from('chama_loans')
    .insert([loanData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChamaLoans(chamaId, borrowerId = null) {
  let query = supabase
    .from('chama_loans')
    .select('*, users(whatsapp_number), chamas(name)')
    .order('created_at', { ascending: false });

  if (chamaId) {
    query = query.eq('chama_id', chamaId);
  }

  if (borrowerId) {
    query = query.eq('borrower_id', borrowerId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function updateChamaLoan(loanId, updates) {
  const { data, error } = await supabase
    .from('chama_loans')
    .update(updates)
    .eq('id', loanId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createChamaPenalty(penaltyData) {
  const { data, error } = await supabase
    .from('chama_penalties')
    .insert([penaltyData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChamaPenalties(chamaId, userId = null) {
  let query = supabase
    .from('chama_penalties')
    .select('*')
    .eq('chama_id', chamaId)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function callDatabaseFunction(functionName, params) {
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) throw error;
  return data;
}
