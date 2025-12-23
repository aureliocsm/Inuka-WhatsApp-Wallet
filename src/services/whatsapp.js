import axios from 'axios';
import { config } from '../config/index.js';

const META_API_URL = `${config.meta.baseUrl}/${config.meta.apiVersion}/${config.meta.phoneNumberId}/messages`;

export async function sendWhatsAppMessage(to, message) {
  if (!config.meta.accessToken || !config.meta.phoneNumberId) {
    console.error('Meta Cloud API not configured');
    return null;
  }

  try {
    const response = await axios.post(
      META_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

export async function sendButtonMessage(to, bodyText, buttons) {
  if (!config.meta.accessToken || !config.meta.phoneNumberId) {
    console.error('Meta Cloud API not configured');
    return null;
  }

  try {
    const response = await axios.post(
      META_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: bodyText,
          },
          action: {
            buttons: buttons.map((btn, idx) => ({
              type: 'reply',
              reply: {
                id: btn.id || `btn_${idx}`,
                title: btn.title,
              },
            })),
          },
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending button message:', error.response?.data || error.message);
    throw error;
  }
}

export async function sendListMessage(to, bodyText, buttonText, sections) {
  if (!config.meta.accessToken || !config.meta.phoneNumberId) {
    console.error('Meta Cloud API not configured');
    return null;
  }

  try {
    const response = await axios.post(
      META_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: bodyText,
          },
          action: {
            button: buttonText,
            sections: sections,
          },
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending list message:', error.response?.data || error.message);
    throw error;
  }
}

export function parseIncomingMessage(webhookBody) {
  try {
    const entry = webhookBody.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    return {
      from: message.from,
      id: message.id,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body,
      interactive: message.interactive,
      button: message.interactive?.button_reply,
      listReply: message.interactive?.list_reply,
    };
  } catch (error) {
    console.error('Error parsing message:', error);
    return null;
  }
}

export function formatBalance(balance) {
  const num = parseFloat(balance);
  if (num === 0) return '0';
  if (num < 0.00001) return num.toExponential(4);
  return num.toFixed(5).replace(/\.?0+$/, '');
}

export function formatMenu() {
  return `
🏦 *WhatsApp Crypto Wallet* 🏦

Welcome! Here's what you can do:

💰 *balance* - Check your wallet balance
📤 *send* - Send money to an address
📥 *receive* - Get your wallet address
📊 *history* - View transaction history
❓ *help* - Show this menu

Reply with any command to get started!
`.trim();
}

export function formatBalanceMessage(ethBalance, usdtBalance, address) {
  return `
💰 *Your Balance*

${formatBalance(ethBalance)} ETH
${formatBalance(usdtBalance)} USDT

📍 *Address:*
\`${address}\`

Network: Scroll Sepolia Testnet
`.trim();
}

export function formatTransactionMessage(tx, type = 'sent') {
  const emoji = type === 'sent' ? '📤' : '📥';
  return `
${emoji} *Transaction ${type === 'sent' ? 'Sent' : 'Received'}*

Amount: ${formatBalance(tx.amount)} ${tx.token_symbol}
Status: ${tx.status}
${tx.tx_hash ? `\nTx Hash: \`${tx.tx_hash.slice(0, 10)}...${tx.tx_hash.slice(-8)}\`` : ''}

View on Scroll Explorer:
https://sepolia.scrollscan.com/tx/${tx.tx_hash}
`.trim();
}
