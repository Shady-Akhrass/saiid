
const fs = require('fs');
const content = fs.readFileSync('d:\\2026\\saiid_unclean\\saiid\\saiid-client\\src\\resources\\project-management\\projects\\ProjectsList.jsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
const startLine = 1332;
const endLine = 1966;

for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i];
    for (let char of line) {
        if (char === '{') balance++;
        if (char === '}') balance--;
    }
    if (balance < 0) {
        console.log(`Brace underflow at line ${i + 1}: ${line}`);
        break;
    }
}
console.log(`Final balance for range ${startLine}-${endLine}: ${balance}`);
