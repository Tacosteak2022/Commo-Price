const fs = require('fs');
const content = fs.readFileSync('vdsc_report_full_dump.html', 'utf8');

const regex = /(file-storage|downloadFrom)/gi;
let match;
const context = 200;

console.log('Searching...');
let count = 0;
while ((match = regex.exec(content)) !== null) {
    count++;
    const start = Math.max(0, match.index - context);
    const end = Math.min(content.length, match.index + match[0].length + context);
    console.log(`--- Match ${count} ---`);
    console.log(content.substring(start, end));
    console.log('------------------');
    if (count > 5) break;
}
if (count === 0) console.log('No matches found.');
