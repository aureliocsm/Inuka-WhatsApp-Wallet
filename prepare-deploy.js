const fs = require('fs');

const indexContent = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf8');
const blockchainContent = fs.readFileSync('supabase/functions/whatsapp-webhook/blockchain.ts', 'utf8');

const deployData = {
  files: [
    { name: 'index.ts', content: indexContent },
    { name: 'blockchain.ts', content: blockchainContent }
  ]
};

// Write to a file that can be used for deployment
fs.writeFileSync('/tmp/cc-agent/61394266/project/deploy-data.json', JSON.stringify(deployData));
console.log('Deployment data prepared');
console.log('Total files:', deployData.files.length);
console.log('index.ts:', indexContent.length, 'characters');
console.log('blockchain.ts:', blockchainContent.length, 'characters');
