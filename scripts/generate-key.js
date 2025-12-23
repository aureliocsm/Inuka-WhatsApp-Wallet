import crypto from 'crypto';

console.log('\n🔐 Generating Encryption Key...\n');

const key = crypto.randomBytes(32).toString('hex');

console.log('Add this to your .env file:');
console.log('\nENCRYPTION_KEY=' + key + '\n');

console.log('⚠️  Keep this key secure and never commit it to git!\n');
