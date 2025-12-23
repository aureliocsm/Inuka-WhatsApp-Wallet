import fs from 'fs';

const indexContent = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf8');
const blockchainContent = fs.readFileSync('supabase/functions/whatsapp-webhook/blockchain.ts', 'utf8');

console.log(JSON.stringify({
  name: 'whatsapp-webhook',
  slug: 'whatsapp-webhook',
  verify_jwt: false,
  entrypoint_path: 'index.ts',
  files: [
    { name: 'index.ts', content: indexContent },
    { name: 'blockchain.ts', content: blockchainContent }
  ]
}));
