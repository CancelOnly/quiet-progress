const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('');
console.log('Copie para o seu .env:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:seu-email@example.com');
console.log('');
