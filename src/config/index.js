import dotenv from 'dotenv';

dotenv.config();

export const config = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY,
  },
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
    businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID,
    apiVersion: 'v21.0',
    baseUrl: 'https://graph.facebook.com',
  },
  blockchain: {
    rpcUrl: process.env.SCROLL_SEPOLIA_RPC_URL || 'https://sepolia-rpc.scroll.io',
    network: process.env.NETWORK || 'scroll-sepolia',
    chainId: parseInt(process.env.CHAIN_ID || '534351'),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
};

export function validateConfig() {
  const required = [
    'META_ACCESS_TOKEN',
    'META_PHONE_NUMBER_ID',
    'META_WEBHOOK_VERIFY_TOKEN',
    'ENCRYPTION_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('Please update your .env file with Meta Cloud API credentials');
  }

  return missing.length === 0;
}
