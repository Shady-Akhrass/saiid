const fs = require('fs');
const content = fs.readFileSync('src/resources/project-management/projects/ProjectsList.jsx', 'utf8');

let stack = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let charIndex = 0; charIndex < line.length; charIndex++) {
        let char = line[charIndex];
        if (char === '{') {
            stack.push({ line: i + 1, char: charIndex + 1 });
        } else if (char === '}') {
            if (stack.length === 0) {
                console.log(`Extra closing brace found at line ${i + 1}, char ${charIndex + 1}`);
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    console.log(`${stack.length} unclosed opening braces found:`);
    stack.forEach(b => {
        console.log(`Unclosed '{' at line ${b.line}, char ${b.char}`);
    });
} else {
    console.log('No unclosed braces found.');
}
