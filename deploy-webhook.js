const fs = require('fs');
const path = require('path');

const indexContent = fs.readFileSync(
  path.join(__dirname, 'supabase/functions/whatsapp-webhook/index.ts'),
  'utf8'
);

const blockchainContent = fs.readFileSync(
  path.join(__dirname, 'supabase/functions/whatsapp-webhook/blockchain.ts'),
  'utf8'
);

console.log('=== FILES TO DEPLOY ===');
console.log('index.ts size:', indexContent.length, 'bytes');
console.log('blockchain.ts size:', blockchainContent.length, 'bytes');
console.log('\n=== DEPLOYMENT DATA ===');
console.log(JSON.stringify({
  files: [
    { name: 'index.ts', content: indexContent },
    { name: 'blockchain.ts', content: blockchainContent }
  ]
}, null, 2));
