const fs = require('fs');

// A valid 1x1 pixel blue PNG
const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf8/9hAAAADUlEQVR42mNkYPhfDwAChwGA6nBy6AAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('public/icon.png', buf);
console.log('Created a valid 1x1 PNG icon at public/icon.png');
