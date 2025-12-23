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
} from '../db/supabase.js';
import { createWallet, getBalance, sendTransaction, estimateGas, isValidAddress } from '../services/wallet.js';
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
This is a Scroll Sepolia testnet wallet. Get free test ETH from:
https://scroll.io/portal/faucet
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
  };

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
          title: 'Check Balance',
          description: 'View your wallet balance',
        },
        {
          id: 'send',
          title: 'Send Money',
          description: 'Send ETH to an address',
        },
        {
          id: 'receive',
          title: 'Receive Money',
          description: 'Get your wallet address',
        },
      ],
    },
    {
      title: 'History & Help',
      rows: [
        {
          id: 'history',
          title: 'Transaction History',
          description: 'View recent transactions',
        },
        {
          id: 'help',
          title: 'Help',
          description: 'Get help and support',
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
    const balance = await getBalance(user.wallet_address);
    const message = formatBalanceMessage(balance, user.wallet_address);
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
      current_step: 'ask_address',
      session_data: {},
    });

    await sendWhatsAppMessage(
      user.whatsapp_number,
      '📤 *Send Money*\n\nPlease enter the recipient\'s Ethereum address:'
    );
  } catch (error) {
    console.error('Error starting send flow:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error starting send flow. Please try again.');
  }
}

async function handleReceiveCommand(user) {
  try {
    const message = `
📥 *Receive Money*

Share this address to receive ETH:

\`${user.wallet_address}\`

Network: Scroll Sepolia Testnet

Anyone can send ETH to this address!
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

    if (transactions.length === 0) {
      await sendWhatsAppMessage(
        user.whatsapp_number,
        '📊 *Transaction History*\n\nNo transactions yet.'
      );
      return;
    }

    let message = '📊 *Transaction History*\n\nLast 5 transactions:\n\n';

    transactions.forEach((tx, idx) => {
      const type = tx.from_user_id === user.id ? 'Sent' : 'Received';
      const emoji = type === 'Sent' ? '📤' : '📥';
      message += `${emoji} ${type}: ${formatBalance(tx.amount)} ${tx.token_symbol}\n`;
      message += `   Status: ${tx.status}\n`;
      message += `   ${new Date(tx.created_at).toLocaleDateString()}\n\n`;
    });

    await sendWhatsAppMessage(user.whatsapp_number, message.trim());
  } catch (error) {
    console.error('Error fetching history:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error fetching history. Please try again.');
  }
}

async function handleHelpCommand(user) {
  await sendWhatsAppMessage(user.whatsapp_number, formatMenu());
}

async function handleSessionMessage(user, session, messageText, extras = {}) {
  const sessionType = session.session_type;

  if (sessionType === 'setup_pin') {
    await handlePinSetupSession(user, session, messageText);
  } else if (sessionType === 'send_money') {
    await handleSendMoneySession(user, session, messageText);
  } else if (sessionType === 'verify_pin') {
    await handlePinVerificationSession(user, session, messageText);
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
        '✅ *PIN created successfully!*\n\nYour wallet is now secure and ready to use.\n\n' + formatMenu()
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
    if (currentStep === 'ask_address') {
      const address = messageText.trim();

      if (!isValidAddress(address)) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          '❌ Invalid Ethereum address. Please enter a valid address:'
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
        '💰 How much ETH do you want to send?\n\nExample: 0.01'
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

      const balance = await getBalance(user.wallet_address);

      if (parseFloat(balance) < amount) {
        await sendWhatsAppMessage(
          user.whatsapp_number,
          `❌ Insufficient balance. Your balance: ${formatBalance(balance)} ETH`
        );
        await deleteSession(session.id);
        return;
      }

      sessionData.amount = amount.toString();

      const gasEstimate = await estimateGas(
        user.wallet_address,
        sessionData.toAddress,
        amount.toString()
      );

      sessionData.gasEstimate = gasEstimate;

      await updateSession(session.id, {
        session_data: sessionData,
        current_step: 'confirm',
      });

      const confirmMessage = `
📤 *Confirm Transaction*

To: \`${sessionData.toAddress}\`
Amount: ${formatBalance(amount)} ETH
Gas Fee: ~${formatBalance(gasEstimate.estimatedFee)} ETH
Total: ~${formatBalance(parseFloat(amount) + parseFloat(gasEstimate.estimatedFee))} ETH
`.trim();

      await sendButtonMessage(user.whatsapp_number, confirmMessage, [
        { id: 'confirm_yes', title: 'Confirm' },
        { id: 'confirm_no', title: 'Cancel' },
      ]);
    } else if (currentStep === 'confirm') {
      if (messageText === 'confirm_yes' || messageText.toUpperCase() === 'YES') {
        sessionData.awaitingPin = true;

        await updateSession(session.id, {
          session_data: sessionData,
          current_step: 'verify_pin',
        });

        await sendWhatsAppMessage(user.whatsapp_number, '🔐 Enter your PIN to confirm the transaction:');
      } else if (messageText === 'confirm_no' || messageText.toUpperCase() === 'NO') {
        await sendWhatsAppMessage(user.whatsapp_number, '❌ Transaction cancelled.');
        await deleteSession(session.id);
      } else {
        await sendWhatsAppMessage(user.whatsapp_number, 'Please click a button or reply YES/NO');
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

      await sendWhatsAppMessage(user.whatsapp_number, '⏳ Processing transaction...');

      const tx = await sendTransaction(
        user.encrypted_private_key,
        sessionData.toAddress,
        sessionData.amount
      );

      const txData = {
        tx_hash: tx.hash,
        from_user_id: user.id,
        to_address: sessionData.toAddress,
        amount: sessionData.amount,
        token_symbol: 'ETH',
        status: 'pending',
        network: 'scroll-sepolia',
      };

      await createTransaction(txData);

      const successMessage = `
✅ *Transaction Sent!*

Amount: ${formatBalance(sessionData.amount)} ETH
To: \`${sessionData.toAddress.slice(0, 10)}...${sessionData.toAddress.slice(-8)}\`

Tx Hash: \`${tx.hash}\`

View on Scroll Explorer:
https://sepolia.scrollscan.com/tx/${tx.hash}

⏳ Waiting for confirmation...
`.trim();

      await sendWhatsAppMessage(user.whatsapp_number, successMessage);

      await logAudit({
        user_id: user.id,
        action: 'transaction_sent',
        details: { tx_hash: tx.hash, amount: sessionData.amount },
      });

      await deleteSession(session.id);
    }
  } catch (error) {
    console.error('Error in send money session:', error);
    await sendWhatsAppMessage(user.whatsapp_number, '❌ Error processing transaction. Please try again.');
    await deleteSession(session.id);
  }
}
