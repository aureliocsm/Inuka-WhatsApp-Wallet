import {
  getUserByWhatsApp,
  createUser,
  updateUser,
  getActiveSession,
  createSession,
  updateSession,
  deleteSession,
  getTransactionsByUser,
  createTransaction,
  logAudit,
  getUserPin,
  getMobileMoneyTransactionsByUser,
  callDatabaseFunction,
} from '../db/supabase.js';
import { createWallet, getBalance, sendTransaction, estimateGas, isValidAddress, formatTo5Decimals } from '../services/wallet.js';
import { encrypt } from '../services/encryption.js';
import {
  sendWhatsAppMessage,
  sendButtonMessage,
  sendListMessage,
  formatMenu,
  formatBalanceMessage,
  formatBalance,
} from '../services/whatsapp.js';
import { createPin, verifyPin, isValidPinFormat } from '../services/pin.js';
import { initiateDeposit, initiateWithdrawal } from '../services/mobileMoney.js';
import {
  createNewChama,
  joinChama,
  depositToChama,
  requestChamaLoan,
  repayChamaLoan,
  getUserChamas,
  getChamaDetails,
} from '../services/chama.js';
import { getChamaLoans } from '../db/supabase.js';

export async function handleIncomingMessage(from, messageData, messageId) {
  try {
    let user = await getUserByWhatsApp(from);

    if (!user) {
      await handleNewUser(from);
      return;
    }

    await updateUser(user.id, { last_active: new Date().toISOString() });

    const session = await getActiveSession(user.id);

    let messageText = '';
    let buttonReply = null;
    let listReply = null;

    if (messageData.type === 'text') {
      messageText = messageData.text.toLowerCase().trim();
    } else if (messageData.type === 'interactive') {
      if (messageData.interactive?.type === 'button_reply') {
        buttonReply = messageData.interactive.button_reply;
        messageText = buttonReply.id;
      } else if (messageData.interactive?.type === 'list_reply') {
        listReply = messageData.interactive.list_reply;
        messageText = listReply.id;
      }
    }

    if (session) {
      await handleSessionMessage(user, session, messageText, { buttonReply, listReply });
    } else {
      await handleCommand(user, messageText);
    }

    await logAudit({
      user_id: user.id,
      action: 'message_received',
      details: { message: messageText, message_id: messageId },
    });
  } catch (error) {
    console.error('Error handling message:', error);
    await sendWhatsAppMessage(from, '❌ An error occurred. Please try again later.');
  }
}

async function handleNewUser(from) {
  try {
    const wallet = createWallet();

    const userData = {
      whatsapp_number: from,
      wallet_address: wallet.address,
      encrypted_private_key: encrypt(wallet.privateKey),
      encrypted_mnemonic: encrypt(wallet.mnemonic),
      is_onboarded: false,
      pin_setup_completed: false,
      eth_balance: 0,
      usdt_balance: 0,
    };

    const user = await createUser(userData);

    const welcomeMessage = `
🎉 *Welcome to WhatsApp Crypto Wallet!*

Your wallet has been created successfully!

📍 *Your Address:*
\`${wallet.address}\`

⚠️ *IMPORTANT - Save Your Backup Phrase:*

\`${wallet.mnemonic}\`

⚠️ *Security Warning:*
• Write down this 12-word phrase
• Store it in a safe place
• NEVER share it with anyone
• You'll need it to recover your wallet

💡 *Getting Started:*
This wallet supports ETH and USDT on Scroll Sepolia testnet.
`.trim();

    await sendWhatsAppMessage(from, welcomeMessage);

    const session = await createSession({
      user_id: user.id,
      session_type: 'setup_pin',
      current_step: 'ask_pin',
      session_data: {},
    });

    await sendWhatsAppMessage(
      from,
      '🔐 *Security Setup*\n\nPlease create a 4-6 digit PIN to secure your wallet.\n\nThis PIN will be required for all transactions.\n\nEnter your PIN:'
    );

    await logAudit({
      user_id: user.id,
      action: 'wallet_created',
      details: { wallet_address: wallet.address },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    await sendWhatsAppMessage(from, '❌ Error creating wallet. Please try again.');
  }
}

async function handleCommand(user, command) {
  if (!user.pin_setup_completed) {
    await sendWhatsAppMessage(
      user.whatsapp_number,
      '🔐 Please complete PIN setup first. Reply with a 4-6 digit PIN.'
    );
    const session = await createSession({
      user_id: user.id,
      session_type: 'setup_pin',
      current_step: 'ask_pin',
      session_data: {},
    });
    return;
  }

  const commands = {
    'balance': handleBalanceCommand,
    'bal': handleBalanceCommand,
    'send': handleSendCommand,
    'receive': handleReceiveCommand,
    'address': handleReceiveCommand,
    'history': handleHistoryCommand,
    'help': handleHelpCommand,
    'menu': handleMenuCommand,
    'deposit': handleDepositCommand,
    'withdraw': handleWithdrawCommand,
    'chama': handleChamaMenuCommand,
    'loans': handleLoansMenuCommand,
  };

  if (command.startsWith('chama_')) {
    await handleChamaMenuSelection(user, command);
    return;
  }

  if (command.startsWith('loan_')) {
    await handleLoansMenuSelection(user, command);
    return;
  }

  const handler = commands[command];

  if (handler) {
    await handler(user);
  } else {
    await sendWhatsAppMessage(
      user.whatsapp_number,
      `❓ Unknown command: "${command}"\n\nType *menu* to see available commands.`
    );
  }
}

async function handleMenuCommand(user) {
  const sections = [
    {
      title: 'Wallet Actions',
      rows: [
        {
          id: 'balance',
          title: '💰 Check Balance',
          description: 'View ETH & USDT balance',
        },
        {
          id: 'send',
          title: '📤 Send Crypto',
          description: 'Send ETH or USDT',
        },
        {
          id: 'receive',
          title: '📥 Receive',
          description: 'Get your wallet address',
        },
        {
          id: 'history',
          title: '📊 History',
          description: 'View transactions',
        },
      ],
    },
    {
      title: 'Mobile Money',
      rows: [
        {
          id: 'deposit',
          title: '💳 Deposit',
          description: 'Buy crypto with M-Pesa',
        },
        {
          id: 'withdraw',
          title: '💸 Withdraw',
          description: 'Cash out to M-Pesa',
        },
      ],
    },
    {
      title: 'Chama & Loans',
      rows: [
        {
          id: 'chama',
          title: '👥 Chama',
          description: 'Group savings & investments',
        },
        {
          id: 'loans',
          title: '💵 Loans',
          description: 'Borrow from your Chama',
        },
      ],
    },
  ];

  await sendListMessage(
    user.whatsapp_number,
    '🏦 *WhatsApp Crypto Wallet*\n\nSelect an action from the menu below:',
    'View Menu',
    sections
  );
}

async function handleBalanceCommand(user) {
  try {
    const ethBalance = formatTo5Decimals(user.eth_balance || 0);
    const usdtBalance = formatTo5Decimals(user.usdt_balance || 0);
    const message = formatBalanceMessage(ethBalance, usdtBalance, user.wallet_address);
    await sendWhatsAppMessage(user.whatsapp_number, message);
  } catch (error) {
    console.error('Error checking balance:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error checking balance. Please try again.');
  }
}

async function handleSendCommand(user) {
  try {
    const session = await createSession({
      user_id: user.id,
      session_type: 'send_money',
      current_step: 'ask_token',
      session_data: {},
    });

    await sendButtonMessage(
      user.whatsapp_number,
      '📤 *Send Money*\n\nWhich token do you want to send?',
      [
        { id: 'send_eth', title: 'ETH' },
        { id: 'send_usdt', title: 'USDT' },
      ]
    );
  } catch (error) {
    console.error('Error starting send flow:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error starting send flow. Please try again.');
  }
}

async function handleDepositCommand(user) {
  try {
    const session = await createSession({
      user_id: user.id,
      session_type: 'mobile_money_deposit',
      current_step: 'ask_token',
      session_data: {},
    });

    await sendButtonMessage(
      user.whatsapp_number,
      '💳 *Deposit via M-Pesa*\n\nWhich token do you want to buy?',
      [
        { id: 'deposit_eth', title: 'ETH' },
        { id: 'deposit_usdt', title: 'USDT' },
      ]
    );
  } catch (error) {
    console.error('Error starting deposit flow:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error starting deposit. Please try again.');
  }
}

async function handleWithdrawCommand(user) {
  try {
    const session = await createSession({
      user_id: user.id,
      session_type: 'mobile_money_withdraw',
      current_step: 'ask_token',
      session_data: {},
    });

    await sendButtonMessage(
      user.whatsapp_number,
      '💸 *Withdraw to M-Pesa*\n\nWhich token do you want to sell?',
      [
        { id: 'withdraw_eth', title: 'ETH' },
        { id: 'withdraw_usdt', title: 'USDT' },
      ]
    );
  } catch (error) {
    console.error('Error starting withdraw flow:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error starting withdrawal. Please try again.');
  }
}

async function handleChamaMenuCommand(user) {
  try {
    const sections = [
      {
        title: 'Chama Actions',
        rows: [
          {
            id: 'chama_create',
            title: '➕ Create Chama',
            description: 'Start a new group',
          },
          {
            id: 'chama_join',
            title: '🔗 Join Chama',
            description: 'Join with invite code',
          },
          {
            id: 'chama_my',
            title: '👥 My Chamas',
            description: 'View your groups',
          },
          {
            id: 'chama_deposit',
            title: '💰 Deposit',
            description: 'Contribute to Chama',
          },
        ],
      },
    ];

    await sendListMessage(
      user.whatsapp_number,
      '👥 *Chama Group Savings*\n\nSelect an action:',
      'View Options',
      sections
    );
  } catch (error) {
    console.error('Error showing Chama menu:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error loading Chama menu.');
  }
}

async function handleChamaMenuSelection(user, selection) {
  try {
    if (selection === 'chama_create') {
      const session = await createSession({
        user_id: user.id,
        session_type: 'chama_create',
        current_step: 'ask_name',
        session_data: {},
      });

      await sendWhatsAppMessage(user.whatsapp_number, '➕ *Create Chama*\n\nEnter Chama name:');
    } else if (selection === 'chama_join') {
      const session = await createSession({
        user_id: user.id,
        session_type: 'chama_join',
        current_step: 'ask_code',
        session_data: {},
      });

      await sendWhatsAppMessage(user.whatsapp_number, '🔗 *Join Chama*\n\nEnter invite code:');
    } else if (selection === 'chama_my') {
      const chamas = await getUserChamas(user.id);

      if (chamas.length === 0) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '👥 *My Chamas*\n\nYou are not a member of any Chama yet.\n\nType *chama* to create or join one!'
        );
        return;
      }

      let message = '👥 *My Chamas*\n\n';
      chamas.forEach((membership) => {
        const chama = membership.chamas;
        message += `*${chama.name}*\n`;
        message += `  Total: $${formatBalance(membership.total_contributions)}\n`;
        message += `  ETH: ${formatBalance(membership.eth_share)}\n`;
        message += `  USDT: ${formatBalance(membership.usdt_share)}\n`;
        message += `  Code: ${chama.invite_code}\n\n`;
      });

      await sendWhatsAppMessage(user.whatsapp_number, message.trim());
    } else if (selection === 'chama_deposit') {
      const chamas = await getUserChamas(user.id);

      if (chamas.length === 0) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ You need to join a Chama first.\n\nType *chama* to create or join one!'
        );
        return;
      }

      if (chamas.length === 1) {
        const session = await createSession({
          user_id: user.id,
          session_type: 'chama_deposit',
          current_step: 'ask_token',
          session_data: { chamaId: chamas[0].chama_id },
        });

        await sendButtonMessage(
          user.whatsapp_number,
          '💰 *Deposit to Chama*\n\nWhich token?',
          [
            { id: 'chama_deposit_eth', title: 'ETH' },
            { id: 'chama_deposit_usdt', title: 'USDT' },
          ]
        );
      } else {
        let message = '💰 *Select Chama*\n\n';
        chamas.forEach((membership, idx) => {
          message += `${idx + 1}. ${membership.chamas.name}\n`;
        });
        message += '\nReply with the number of the Chama:';

        const session = await createSession({
          user_id: user.id,
          session_type: 'chama_deposit',
          current_step: 'select_chama',
          session_data: { chamas },
        });

        await sendWhatsAppMessage(user.whatsapp_number, message);
      }
    }
  } catch (error) {
    console.error('Error handling Chama menu selection:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error processing your request.');
  }
}

async function handleLoansMenuSelection(user, selection) {
  try {
    if (selection === 'loan_request') {
      const chamas = await getUserChamas(user.id);

      if (chamas.length === 0) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ You need to join a Chama first.\n\nType *chama* to create or join one!'
        );
        return;
      }

      let message = '💵 *Select Chama for Loan*\n\n';
      chamas.forEach((membership, idx) => {
        message += `${idx + 1}. ${membership.chamas.name}\n`;
      });
      message += '\nReply with the number:';

      const session = await createSession({
        user_id: user.id,
        session_type: 'loan_request',
        current_step: 'select_chama',
        session_data: { chamas },
      });

      await sendWhatsAppMessage(user.whatsapp_number, message);
    } else if (selection === 'loan_repay') {
      const loans = await getChamaLoans(null, user.id);
      const activeLoans = loans.filter((l) => l.status === 'active');

      if (activeLoans.length === 0) {
        await sendWhatsAppMessage(user.whatsapp_number, '📋 *My Loans*\n\nYou have no active loans.');
        return;
      }

      let message = '💳 *Select Loan to Repay*\n\n';
      activeLoans.forEach((loan, idx) => {
        message += `${idx + 1}. ${loan.chamas.name}\n`;
        message += `   Amount: ${formatBalance(loan.loan_amount)} ${loan.token_symbol}\n`;
        message += `   Outstanding: ${formatBalance(loan.outstanding_balance)} ${loan.token_symbol}\n\n`;
      });
      message += 'Reply with the number:';

      const session = await createSession({
        user_id: user.id,
        session_type: 'loan_repay',
        current_step: 'select_loan',
        session_data: { loans: activeLoans },
      });

      await sendWhatsAppMessage(user.whatsapp_number, message);
    } else if (selection === 'loan_my') {
      const loans = await getChamaLoans(null, user.id);

      if (loans.length === 0) {
        await sendWhatsAppMessage(user.whatsapp_number, '📋 *My Loans*\n\nYou have no loans yet.');
        return;
      }

      let message = '📋 *My Loans*\n\n';
      loans.forEach((loan) => {
        message += `*${loan.chamas.name}*\n`;
        message += `  Amount: ${formatBalance(loan.loan_amount)} ${loan.token_symbol}\n`;
        message += `  Outstanding: ${formatBalance(loan.outstanding_balance)} ${loan.token_symbol}\n`;
        message += `  Status: ${loan.status}\n\n`;
      });

      await sendWhatsAppMessage(user.whatsapp_number, message.trim());
    }
  } catch (error) {
    console.error('Error handling loans menu selection:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error processing your request.');
  }
}

async function handleLoansMenuCommand(user) {
  try {
    const sections = [
      {
        title: 'Loan Actions',
        rows: [
          {
            id: 'loan_request',
            title: '💵 Request Loan',
            description: 'Borrow from Chama',
          },
          {
            id: 'loan_repay',
            title: '💳 Repay Loan',
            description: 'Pay back your loan',
          },
          {
            id: 'loan_my',
            title: '📋 My Loans',
            description: 'View your loans',
          },
        ],
      },
    ];

    await sendListMessage(
      user.whatsapp_number,
      '💵 *Chama Loans*\n\nSelect an action:',
      'View Options',
      sections
    );
  } catch (error) {
    console.error('Error showing loans menu:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error loading loans menu.');
  }
}

async function handleReceiveCommand(user) {
  try {
    const message = `
📥 *Receive Money*

Share this address to receive crypto:

\`${user.wallet_address}\`

Network: Scroll Sepolia Testnet

Anyone can send ETH or USDT to this address!
`.trim();

    await sendWhatsAppMessage(user.whatsapp_number, message);
  } catch (error) {
    console.error('Error in receive command:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error retrieving address. Please try again.');
  }
}

async function handleHistoryCommand(user) {
  try {
    const transactions = await getTransactionsByUser(user.id, 5);
    const mobileMoneyTxs = await getMobileMoneyTransactionsByUser(user.id, 5);

    if (transactions.length === 0 && mobileMoneyTxs.length === 0) {
      await sendWhatsAppMessage(
        user.whatsapp_number,
        '📊 *Transaction History*\n\nNo transactions yet.'
      );
      return;
    }

    let message = '📊 *Transaction History*\n\n';

    if (transactions.length > 0) {
      message += '*Crypto Transactions:*\n';
      transactions.slice(0, 3).forEach((tx) => {
        const type = tx.from_user_id === user.id ? 'Sent' : 'Received';
        const emoji = type === 'Sent' ? '📤' : '📥';
        message += `${emoji} ${type}: ${formatBalance(tx.amount)} ${tx.token_symbol}\n`;
        message += `   Status: ${tx.status}\n\n`;
      });
    }

    if (mobileMoneyTxs.length > 0) {
      message += '*Mobile Money:*\n';
      mobileMoneyTxs.slice(0, 3).forEach((tx) => {
        const emoji = tx.transaction_type === 'deposit' ? '💳' : '💸';
        message += `${emoji} ${tx.transaction_type}: ${formatBalance(tx.amount_crypto)} ${tx.token_symbol}\n`;
        message += `   Status: ${tx.status}\n\n`;
      });
    }

    await sendWhatsAppMessage(user.whatsapp_number, message.trim());
  } catch (error) {
    console.error('Error fetching history:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error fetching history. Please try again.');
  }
}

async function handleHelpCommand(user) {
  const message = `
🏦 *WhatsApp Crypto Wallet Help*

*Main Commands:*
• balance - Check ETH & USDT balance
• send - Send crypto to an address
• receive - Get your wallet address
• deposit - Buy crypto with M-Pesa
• withdraw - Cash out to M-Pesa
• chama - Group savings & investments
• loans - Borrow from Chama
• history - View transactions
• menu - Show main menu

Reply with any command to get started!
`.trim();

  await sendWhatsAppMessage(user.whatsapp_number, message);
}

async function handleSessionMessage(user, session, messageText, extras = {}) {
  const sessionType = session.session_type;

  if (sessionType === 'setup_pin') {
    await handlePinSetupSession(user, session, messageText);
  } else if (sessionType === 'send_money') {
    await handleSendMoneySession(user, session, messageText);
  } else if (sessionType === 'mobile_money_deposit') {
    await handleMobileMoneyDepositSession(user, session, messageText);
  } else if (sessionType === 'mobile_money_withdraw') {
    await handleMobileMoneyWithdrawSession(user, session, messageText);
  } else if (sessionType === 'chama_create') {
    await handleChamaCreateSession(user, session, messageText);
  } else if (sessionType === 'chama_join') {
    await handleChamaJoinSession(user, session, messageText);
  } else if (sessionType === 'chama_deposit') {
    await handleChamaDepositSession(user, session, messageText);
  } else if (sessionType === 'loan_request') {
    await handleLoanRequestSession(user, session, messageText);
  } else if (sessionType === 'loan_repay') {
    await handleLoanRepaySession(user, session, messageText);
  }
}

async function handlePinSetupSession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'ask_pin') {
      const pin = messageText.trim();

      if (!isValidPinFormat(pin)) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ Invalid PIN format. Please enter a 4-6 digit PIN:'
        );
        return;
      }

      sessionData.pin = pin;

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'confirm_pin',
      });

      await sendWhatsAppMessage(
        user.whatsapp_number,
        '🔐 Please confirm your PIN by entering it again:'
      );
    } else if (currentStep === 'confirm_pin') {
      const confirmPin = messageText.trim();

      if (confirmPin !== sessionData.pin) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ PINs do not match. Let\'s start over.\n\nEnter your new PIN (4-6 digits):'
        );

        await updateSession(session.id, {
          session_data: {},
          current_step: 'ask_pin',
        });
        return;
      }

      await createPin(user.id, sessionData.pin);
      await updateUser(user.id, { pin_setup_completed: true, is_onboarded: true });

      await sendWhatsAppMessage(
        user.whatsapp_number,
        '✅ *PIN created successfully!*\n\nYour wallet is now secure and ready to use.\n\nType *menu* to see all available features!'
      );

      await deleteSession(session.id);

      await logAudit({
        user_id: user.id,
        action: 'pin_created',
        details: {},
      });
    }
  } catch (error) {
    console.error('Error in PIN setup:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error setting up PIN. Please try again.');
    await deleteSession(session.id);
  }
}

async function handleSendMoneySession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'ask_token') {
      if (messageText === 'send_eth') {
        sessionData.tokenSymbol = 'ETH';
      } else if (messageText === 'send_usdt') {
        sessionData.tokenSymbol = 'USDT';
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, 'Please select ETH or USDT');
        return;
      }

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_address',
      });

      await sendWhatsAppMessage(
        user.whatsapp_number,
        '📤 *Send Money*\n\nPlease enter the recipient\'s address:'
      );
    } else if (currentStep === 'ask_address') {
      const address = messageText.trim();

      if (!isValidAddress(address)) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ Invalid address. Please enter a valid Ethereum address:'
        );
        return;
      }

      sessionData.toAddress = address;

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_amount',
      });

      await sendWhatsAppMessage(
        user.whatsapp_number,
        `💰 How much ${sessionData.tokenSymbol} do you want to send?\n\nExample: 0.01`
      );
    } else if (currentStep === 'ask_amount') {
      const amount = parseFloat(messageText.trim());

      if (isNaN(amount) || amount <= 0) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ Invalid amount. Please enter a valid number:\n\nExample: 0.01'
        );
        return;
      }

      const formattedAmount = formatTo5Decimals(amount);
      const tokenSymbol = sessionData.tokenSymbol;
      const userBalance = tokenSymbol === 'ETH' ? user.eth_balance : user.usdt_balance;

      if (formattedAmount > userBalance) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          `❌ Insufficient balance. Your balance: ${formatBalance(userBalance)} ${tokenSymbol}`
        );
        await deleteSession(session.id);
        return;
      }

      sessionData.amount = formattedAmount;

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'confirm',
      });

      const confirmMessage = `
📤 *Confirm Transaction*

To: \`${sessionData.toAddress}\`
Amount: ${formatBalance(formattedAmount)} ${tokenSymbol}
`.trim();

      await sendButtonMessage(user.whatsapp_number, confirmMessage, [
        { id: 'confirm_yes', title: 'Confirm' },
        { id: 'confirm_no', title: 'Cancel' },
      ]);
    } else if (currentStep === 'confirm') {
      if (messageText === 'confirm_yes') {
        await updateSession(session.id, {
          session_data: sessionData,
          current_step: 'verify_pin',
        });

        await sendWhatsAppMessage(user.whatsapp_number, '🔐 Enter your PIN to confirm:');
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, '❌ Transaction cancelled.');
        await deleteSession(session.id);
      }
    } else if (currentStep === 'verify_pin') {
      const pin = messageText.trim();
      const verifyResult = await verifyPin(user.id, pin);

      if (!verifyResult.success) {
        await sendWhatsAppMessage(user.whatsapp_number, `❌ ${verifyResult.error}`);
        if (verifyResult.locked) {
          await deleteSession(session.id);
        }
        return;
      }

      const tokenSymbol = sessionData.tokenSymbol;
      const decrementSuccess = await callDatabaseFunction(
        tokenSymbol === 'ETH' ? 'decrement_eth_balance' : 'decrement_usdt_balance',
        {
          user_id_param: user.id,
          amount_param: sessionData.amount,
        }
      );

      if (!decrementSuccess) {
        await sendWhatsAppMessage(user.whatsapp_number, '❌ Insufficient balance.');
        await deleteSession(session.id);
        return;
      }

      await sendWhatsAppMessage(user.whatsapp_number, '✅ Transaction successful!');
      await deleteSession(session.id);
    }
  } catch (error) {
    console.error('Error in send money session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error processing transaction.');
    await deleteSession(session.id);
  }
}

async function handleMobileMoneyDepositSession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'ask_token') {
      if (messageText === 'deposit_eth') {
        sessionData.tokenSymbol = 'ETH';
      } else if (messageText === 'deposit_usdt') {
        sessionData.tokenSymbol = 'USDT';
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, 'Please select ETH or USDT');
        return;
      }

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_amount',
      });

      await sendWhatsAppMessage(
        user.whatsapp_number,
        '💳 *Deposit via M-Pesa*\n\nEnter amount in TZS:\n\nExample: 10000'
      );
    } else if (currentStep === 'ask_amount') {
      const tzsAmount = parseInt(messageText.trim());

      if (isNaN(tzsAmount) || tzsAmount < 1000) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ Invalid amount. Minimum 1000 TZS.\n\nEnter amount:'
        );
        return;
      }

      sessionData.tzsAmount = tzsAmount;

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_phone',
      });

      await sendWhatsAppMessage(
        user.whatsapp_number,
        '📱 Enter your M-Pesa phone number:\n\nExample: 255712345678'
      );
    } else if (currentStep === 'ask_phone') {
      const phoneNumber = messageText.trim();

      if (!/^255\d{9}$/.test(phoneNumber)) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ Invalid phone number. Format: 255XXXXXXXXX'
        );
        return;
      }

      sessionData.phoneNumber = phoneNumber;

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'confirm',
      });

      const confirmMessage = `
💳 *Confirm Deposit*

Amount: ${sessionData.tzsAmount} TZS
Token: ${sessionData.tokenSymbol}
Phone: ${phoneNumber}
`.trim();

      await sendButtonMessage(user.whatsapp_number, confirmMessage, [
        { id: 'confirm_yes', title: 'Confirm' },
        { id: 'confirm_no', title: 'Cancel' },
      ]);
    } else if (currentStep === 'confirm') {
      if (messageText === 'confirm_yes') {
        await sendWhatsAppMessage(user.whatsapp_number, '⏳ Processing deposit...');

        const result = await initiateDeposit(
          user.id,
          sessionData.phoneNumber,
          sessionData.tzsAmount,
          sessionData.tokenSymbol
        );

        if (result.success) {
          const message = `
✅ *Deposit Initiated!*

You will receive ${formatBalance(result.cryptoAmount)} ${result.tokenSymbol}

Please complete the M-Pesa prompt on your phone.

You'll be notified when the deposit is complete.
`.trim();

          await sendWhatsAppMessage(user.whatsapp_number, message);
        } else {
          await sendWhatsAppMessage(user.whatsapp_number, `❌ Deposit failed: ${result.error}`);
        }

        await deleteSession(session.id);
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, '❌ Deposit cancelled.');
        await deleteSession(session.id);
      }
    }
  } catch (error) {
    console.error('Error in deposit session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error processing deposit.');
    await deleteSession(session.id);
  }
}

async function handleMobileMoneyWithdrawSession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'ask_token') {
      if (messageText === 'withdraw_eth') {
        sessionData.tokenSymbol = 'ETH';
      } else if (messageText === 'withdraw_usdt') {
        sessionData.tokenSymbol = 'USDT';
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, 'Please select ETH or USDT');
        return;
      }

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_amount',
      });

      const balance = sessionData.tokenSymbol === 'ETH' ? user.eth_balance : user.usdt_balance;
      await sendWhatsAppMessage(
        user.whatsapp_number,
        `💸 *Withdraw to M-Pesa*\n\nYour balance: ${formatBalance(balance)} ${sessionData.tokenSymbol}\n\nEnter amount to withdraw:`
      );
    } else if (currentStep === 'ask_amount') {
      const cryptoAmount = parseFloat(messageText.trim());

      if (isNaN(cryptoAmount) || cryptoAmount <= 0) {
        await sendWhatsAppMessage(user.whatsapp_number, '❌ Invalid amount. Try again:');
        return;
      }

      sessionData.cryptoAmount = formatTo5Decimals(cryptoAmount);

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_phone',
      });

      await sendWhatsAppMessage(
        user.whatsapp_number,
        '📱 Enter your M-Pesa phone number:\n\nExample: 255712345678'
      );
    } else if (currentStep === 'ask_phone') {
      const phoneNumber = messageText.trim();

      if (!/^255\d{9}$/.test(phoneNumber)) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ Invalid phone number. Format: 255XXXXXXXXX'
        );
        return;
      }

      sessionData.phoneNumber = phoneNumber;

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'confirm',
      });

      const confirmMessage = `
💸 *Confirm Withdrawal*

Amount: ${formatBalance(sessionData.cryptoAmount)} ${sessionData.tokenSymbol}
Phone: ${phoneNumber}
`.trim();

      await sendButtonMessage(user.whatsapp_number, confirmMessage, [
        { id: 'confirm_yes', title: 'Confirm' },
        { id: 'confirm_no', title: 'Cancel' },
      ]);
    } else if (currentStep === 'confirm') {
      if (messageText === 'confirm_yes') {
        await sendWhatsAppMessage(user.whatsapp_number, '⏳ Processing withdrawal...');

        const userBalance = sessionData.tokenSymbol === 'ETH' ? user.eth_balance : user.usdt_balance;
        const result = await initiateWithdrawal(
          user.id,
          sessionData.phoneNumber,
          sessionData.cryptoAmount,
          sessionData.tokenSymbol,
          userBalance
        );

        if (result.success) {
          const message = `
✅ *Withdrawal Initiated!*

You will receive ${result.tzsAmount} TZS

The money will be sent to ${result.phoneNumber} shortly.
`.trim();

          await sendWhatsAppMessage(user.whatsapp_number, message);
        } else {
          await sendWhatsAppMessage(user.whatsapp_number, `❌ Withdrawal failed: ${result.error}`);
        }

        await deleteSession(session.id);
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, '❌ Withdrawal cancelled.');
        await deleteSession(session.id);
      }
    }
  } catch (error) {
    console.error('Error in withdrawal session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error processing withdrawal.');
    await deleteSession(session.id);
  }
}

async function handleChamaCreateSession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'ask_name') {
      sessionData.name = messageText.trim();

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_description',
      });

      await sendWhatsAppMessage(user.whatsapp_number, 'Enter Chama description:');
    } else if (currentStep === 'ask_description') {
      sessionData.description = messageText.trim();

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'confirm',
      });

      const confirmMessage = `
➕ *Confirm Chama Creation*

Name: ${sessionData.name}
Description: ${sessionData.description}
Share Price: $10 USD
Weekly Min: $5 USD
Loan Interest: 5%
Auto-invest: 10% in ETH
`.trim();

      await sendButtonMessage(user.whatsapp_number, confirmMessage, [
        { id: 'confirm_yes', title: 'Create' },
        { id: 'confirm_no', title: 'Cancel' },
      ]);
    } else if (currentStep === 'confirm') {
      if (messageText === 'confirm_yes') {
        const result = await createNewChama(
          user.id,
          sessionData.name,
          sessionData.description,
          10,
          5,
          5,
          3,
          10
        );

        if (result.success) {
          const message = `
✅ *Chama Created!*

Name: ${sessionData.name}
Invite Code: ${result.inviteCode}

Share this code with members to join!
`.trim();

          await sendWhatsAppMessage(user.whatsapp_number, message);
        } else {
          await sendWhatsAppMessage(user.whatsapp_number, `❌ Failed: ${result.error}`);
        }

        await deleteSession(session.id);
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, '❌ Cancelled.');
        await deleteSession(session.id);
      }
    }
  } catch (error) {
    console.error('Error in Chama create session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error creating Chama.');
    await deleteSession(session.id);
  }
}

async function handleChamaJoinSession(user, session, messageText) {
  try {
    const inviteCode = messageText.trim().toUpperCase();

    const result = await joinChama(user.id, inviteCode);

    if (result.success) {
      await sendWhatsAppMessage(
        user.whatsapp_number,
        `✅ You've joined ${result.chama.name}!\n\nType *chama* to see your groups.`
      );
    } else {
      await sendWhatsAppMessage(user.whatsapp_number, `❌ ${result.error}`);
    }

    await deleteSession(session.id);
  } catch (error) {
    console.error('Error in Chama join session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error joining Chama.');
    await deleteSession(session.id);
  }
}

async function handleChamaDepositSession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'select_chama') {
      sessionData.chamaId = messageText.trim();

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_token',
      });

      await sendButtonMessage(
        user.whatsapp_number,
        '💰 *Deposit to Chama*\n\nWhich token?',
        [
          { id: 'chama_deposit_eth', title: 'ETH' },
          { id: 'chama_deposit_usdt', title: 'USDT' },
        ]
      );
    } else if (currentStep === 'ask_token') {
      if (messageText === 'chama_deposit_eth') {
        sessionData.tokenSymbol = 'ETH';
      } else if (messageText === 'chama_deposit_usdt') {
        sessionData.tokenSymbol = 'USDT';
      }

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_amount',
      });

      await sendWhatsAppMessage(user.whatsapp_number, `Enter amount in ${sessionData.tokenSymbol}:`);
    } else if (currentStep === 'ask_amount') {
      const amount = parseFloat(messageText.trim());
      sessionData.amount = formatTo5Decimals(amount);

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_usd_value',
      });

      await sendWhatsAppMessage(user.whatsapp_number, 'Enter USD value of this amount:');
    } else if (currentStep === 'ask_usd_value') {
      sessionData.usdValue = parseFloat(messageText.trim());

      const result = await depositToChama(
        user.id,
        sessionData.chamaId,
        sessionData.tokenSymbol,
        sessionData.amount,
        sessionData.usdValue
      );

      if (result.success) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          `✅ Deposited ${formatBalance(sessionData.amount)} ${sessionData.tokenSymbol} to Chama!\n\n10% auto-invested in ETH.`
        );
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, `❌ ${result.error}`);
      }

      await deleteSession(session.id);
    }
  } catch (error) {
    console.error('Error in Chama deposit session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error depositing to Chama.');
    await deleteSession(session.id);
  }
}

async function handleLoanRequestSession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'select_chama') {
      sessionData.chamaId = messageText.trim();

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_amount',
      });

      await sendWhatsAppMessage(user.whatsapp_number, '💵 Enter loan amount:');
    } else if (currentStep === 'ask_amount') {
      sessionData.loanAmount = formatTo5Decimals(parseFloat(messageText.trim()));

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_token',
      });

      await sendButtonMessage(
        user.whatsapp_number,
        'Which token for loan?',
        [
          { id: 'loan_eth', title: 'ETH' },
          { id: 'loan_usdt', title: 'USDT' },
        ]
      );
    } else if (currentStep === 'ask_token') {
      if (messageText === 'loan_eth') {
        sessionData.tokenSymbol = 'ETH';
      } else if (messageText === 'loan_usdt') {
        sessionData.tokenSymbol = 'USDT';
      }

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_collateral',
      });

      const requiredCollateral = formatTo5Decimals(sessionData.loanAmount * 1.5);
      await sendWhatsAppMessage(
        user.whatsapp_number,
        `Collateral required: ${requiredCollateral} ${sessionData.tokenSymbol}\n\nEnter collateral amount:`
      );
    } else if (currentStep === 'ask_collateral') {
      sessionData.collateralAmount = formatTo5Decimals(parseFloat(messageText.trim()));

      const result = await requestChamaLoan(
        user.id,
        sessionData.chamaId,
        sessionData.loanAmount,
        sessionData.tokenSymbol,
        sessionData.collateralAmount,
        sessionData.tokenSymbol
      );

      if (result.success) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          `✅ Loan approved!\n\nAmount: ${formatBalance(sessionData.loanAmount)} ${sessionData.tokenSymbol}\nRepayment: ${formatBalance(result.totalRepayment)} ${sessionData.tokenSymbol}\nInterest: 5%`
        );
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, `❌ ${result.error}`);
      }

      await deleteSession(session.id);
    }
  } catch (error) {
    console.error('Error in loan request session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error requesting loan.');
    await deleteSession(session.id);
  }
}

async function handleLoanRepaySession(user, session, messageText) {
  const currentStep = session.current_step;
  const sessionData = session.session_data || {};

  try {
    if (currentStep === 'select_loan') {
      sessionData.loanId = messageText.trim();

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'ask_amount',
      });

      await sendWhatsAppMessage(user.whatsapp_number, '💳 Enter repayment amount:');
    } else if (currentStep === 'ask_amount') {
      const repaymentAmount = formatTo5Decimals(parseFloat(messageText.trim()));

      const result = await repayChamaLoan(user.id, sessionData.loanId, repaymentAmount);

      if (result.success) {
        let message = `✅ Payment successful!\n\nRemaining: ${formatBalance(result.newOutstanding)}`;
        if (result.isFullyRepaid) {
          message += '\n\n🎉 Loan fully repaid! Collateral returned.';
        }
        await sendWhatsAppMessage(user.whatsapp_number, message);
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, `❌ ${result.error}`);
      }

      await deleteSession(session.id);
    }
  } catch (error) {
    console.error('Error in loan repay session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error repaying loan.');
    await deleteSession(session.id);
  }
}
