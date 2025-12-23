import express from 'express';
import { config, validateConfig } from './config/index.js';
import { parseIncomingMessage } from './services/whatsapp.js';
import { handleIncomingMessage } from './handlers/messageHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Crypto Wallet',
    version: '1.0.0',
    status: 'running',
    network: config.blockchain.network,
  });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

app.post('/webhook', rateLimiter, async (req, res) => {
  res.sendStatus(200);

  try {
    const message = parseIncomingMessage(req.body);

    if (message) {
      const displayText = message.text || message.button?.id || message.listReply?.id || '[interactive]';
      console.log(`📨 Message from ${message.from}: ${displayText}`);
      await handleIncomingMessage(message.from, message, message.id);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

const isConfigValid = validateConfig();

app.listen(config.server.port, () => {
  console.log('\n🚀 WhatsApp Crypto Wallet Server Started\n');
  console.log(`📍 Server: http://localhost:${config.server.port}`);
  console.log(`🌐 Network: ${config.blockchain.network}`);
  console.log(`⛓️  Chain ID: ${config.blockchain.chainId}`);
  console.log(`🔗 RPC: ${config.blockchain.rpcUrl}\n`);

  if (!isConfigValid) {
    console.log('⚠️  Please configure Meta Cloud API credentials in .env file\n');
    console.log('📖 Setup instructions:');
    console.log('   1. Create a Meta Business Account');
    console.log('   2. Set up WhatsApp Business API');
    console.log('   3. Get your access token and phone number ID');
    console.log('   4. Update .env with your credentials\n');
  } else {
    console.log('✅ Meta Cloud API configured');
    console.log('📱 WhatsApp bot is ready!\n');
  }
});
