// Deduplicate and fill cards_kids_quiz.js to 150 unique questions per level
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'cards/cards_kids_quiz.js');
let content = fs.readFileSync(file, 'utf8');

// Parse existing cards
const cardRegex = /\{level:(\d), q:'([^']*)', a:\[([^\]]*)\]\}/g;
let match;
const levels = {1:[], 2:[], 3:[], 4:[]};
const allQuestions = new Set();

while((match = cardRegex.exec(content)) !== null){
  const level = parseInt(match[1]);
  const q = match[2];
  levels[level].push({q, answers: match[3]});
  allQuestions.add(q);
}

// Deduplicate within each level (keep first occurrence)
for(let i=1; i<=4; i++){
  const seen = new Set();
  levels[i] = levels[i].filter(card => {
    if(seen.has(card.q)) return false;
    seen.add(card.q);
    return true;
  });
}

console.log('After dedup:');
for(let i=1; i<=4; i++){
  console.log(`  Level ${i}: ${levels[i].length} unique cards (need ${150 - levels[i].length} more)`);
}

// Deterministic distractor generation
function genOptions(correctStr, wrong1, wrong2, wrong3){
  return [correctStr, wrong1, wrong2, wrong3];
}

// Generate deterministic unique questions per level
function genLevel1(needed){
  const qs = [];
  let n = 1;
  for(let a=1; a<=20 && qs.length < needed; a++){
    for(let b=0; b<=10 && qs.length < needed; b++){
      const q = `Сколько будет ${a}+${b}?`;
      const ans = String(a+b);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:1, q:'${q}', a:[${genOptions(ans, String(a+b-1), String(a+b+1), String(a+b+2)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  // subtraction
  for(let a=10; a<=30 && qs.length < needed; a++){
    for(let b=1; b<=9 && qs.length < needed; b++){
      if(a-b < 0) continue;
      const q = `Сколько будет ${a}−${b}?`;
      const ans = String(a-b);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:1, q:'${q}', a:[${genOptions(ans, String(a-b-1), String(a-b+1), String(a-b+2)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  return qs;
}

function genLevel2(needed){
  const qs = [];
  for(let a=2; a<=12 && qs.length < needed; a++){
    for(let b=2; b<=12 && qs.length < needed; b++){
      const q = `Сколько будет ${a}×${b}?`;
      const ans = String(a*b);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:2, q:'${q}', a:[${genOptions(ans, String(a*b-1), String(a*b+1), String(a*b+a)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  // division
  for(let a=2; a<=12 && qs.length < needed; a++){
    for(let b=2; b<=12 && qs.length < needed; b++){
      const prod = a*b;
      const q = `Сколько будет ${prod}÷${b}?`;
      const ans = String(a);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:2, q:'${q}', a:[${genOptions(ans, String(a-1), String(a+1), String(a+2)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  return qs;
}

function genLevel3(needed){
  const qs = [];
  // Powers
  for(let base=2; base<=15 && qs.length < needed; base++){
    for(let exp=2; exp<=4 && qs.length < needed; exp++){
      const val = Math.pow(base, exp);
      if(val > 1000) continue;
      const q = `Чему равно ${base} в степени ${exp}?`;
      const ans = String(val);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:3, q:'${q}', a:[${genOptions(ans, String(val-1), String(val+1), String(val+val)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  // Squares
  for(let n=5; n<=30 && qs.length < needed; n++){
    const q = `Чему равен квадрат ${n}?`;
    const ans = String(n*n);
    if(!allQuestions.has(q)){
      allQuestions.add(q);
      qs.push({q, raw: `  {level:3, q:'${q}', a:[${genOptions(ans, String(n*n-1), String(n*n+1), String(n*n+n)).map(o=>"'"+o+"'").join(', ')}]}`});
    }
  }
  // Cubes
  for(let n=3; n<=15 && qs.length < needed; n++){
    const q = `Чему равен куб ${n}?`;
    const ans = String(n*n*n);
    if(!allQuestions.has(q)){
      allQuestions.add(q);
      qs.push({q, raw: `  {level:3, q:'${q}', a:[${genOptions(ans, String(n*n*n-1), String(n*n*n+1), String(n*n*n+n)).map(o=>"'"+o+"'").join(', ')}]}`});
    }
  }
  // Percentages
  for(let p=5; p<=50 && qs.length < needed; p+=3){
    for(let total of [80, 100, 120, 150, 200, 250, 300, 400, 500]){
      const val = Math.round(p/100 * total);
      const q = `Сколько будет ${p}% от ${total}?`;
      const ans = String(val);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:3, q:'${q}', a:[${genOptions(ans, String(val-1), String(val+1), String(val+5)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
      if(qs.length >= needed) break;
    }
  }
  // Square roots
  for(let n=2; n<=20 && qs.length < needed; n++){
    const sq = n*n;
    const q = `Чему равен квадратный корень из ${sq}?`;
    const ans = String(n);
    if(!allQuestions.has(q)){
      allQuestions.add(q);
      qs.push({q, raw: `  {level:3, q:'${q}', a:[${genOptions(ans, String(n-1), String(n+1), String(n+2)).map(o=>"'"+o+"'").join(', ')}]}`});
    }
  }
  return qs;
}

function genLevel4(needed){
  const qs = [];
  // Advanced powers
  for(let base=2; base<=20 && qs.length < needed; base++){
    for(let exp=3; exp<=5 && qs.length < needed; exp++){
      const val = Math.pow(base, exp);
      if(val > 10000) continue;
      const q = `Чему равно ${base} в степени ${exp}?`;
      const ans = String(val);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:4, q:'${q}', a:[${genOptions(ans, String(val-1), String(val+1), String(val*2)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  // Large multiplication
  for(let a=13; a<=30 && qs.length < needed; a++){
    for(let b=11; b<=20 && qs.length < needed; b++){
      const q = `Чему равно ${a}×${b}?`;
      const ans = String(a*b);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:4, q:'${q}', a:[${genOptions(ans, String(a*b-1), String(a*b+1), String(a*b+a)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  // More multiplication
  for(let a=21; a<=60 && qs.length < needed; a++){
    for(let b=3; b<=12 && qs.length < needed; b++){
      const q = `Чему равно ${a}×${b}?`;
      const ans = String(a*b);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:4, q:'${q}', a:[${genOptions(ans, String(a*b-1), String(a*b+1), String(a*b+a)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  // Division
  for(let a=13; a<=30 && qs.length < needed; a++){
    for(let b=6; b<=15 && qs.length < needed; b++){
      const prod = a*b;
      const q = `Чему равен остаток от ${prod}÷${b}?`;
      const ans = '0';
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:4, q:'${q}', a:[${genOptions(ans, '1', '2', '3').map(o=>"'"+o+"'").join(', ')}]}`});
      }
    }
  }
  // Percentages
  for(let p=5; p<=80 && qs.length < needed; p+=5){
    for(let total of [150, 200, 250, 300, 400, 500, 800, 1000]){
      const val = Math.round(p/100 * total);
      const q = `Сколько будет ${p}% от ${total}?`;
      const ans = String(val);
      if(!allQuestions.has(q)){
        allQuestions.add(q);
        qs.push({q, raw: `  {level:4, q:'${q}', a:[${genOptions(ans, String(val-1), String(val+1), String(val+10)).map(o=>"'"+o+"'").join(', ')}]}`});
      }
      if(qs.length >= needed) break;
    }
  }
  // Square roots
  for(let n=11; n<=40 && qs.length < needed; n++){
    const sq = n*n;
    const q = `Чему равен квадратный корень из ${sq}?`;
    const ans = String(n);
    if(!allQuestions.has(q)){
      allQuestions.add(q);
      qs.push({q, raw: `  {level:4, q:'${q}', a:[${genOptions(ans, String(n-1), String(n+1), String(n+2)).map(o=>"'"+o+"'").join(', ')}]}`});
    }
  }
  // Cubes
  for(let n=5; n<=25 && qs.length < needed; n++){
    const cube = n*n*n;
    const q = `Чему равен куб ${n}?`;
    const ans = String(cube);
    if(!allQuestions.has(q)){
      allQuestions.add(q);
      qs.push({q, raw: `  {level:4, q:'${q}', a:[${genOptions(ans, String(cube-1), String(cube+1), String(cube+10)).map(o=>"'"+o+"'").join(', ')}]}`});
    }
  }
  return qs;
}

// Add new questions
const newL1 = genLevel1(150 - levels[1].length);
const newL2 = genLevel2(150 - levels[2].length);
const newL3 = genLevel3(150 - levels[3].length);
const newL4 = genLevel4(150 - levels[4].length);

newL1.forEach(q => levels[1].push(q));
newL2.forEach(q => levels[2].push(q));
newL3.forEach(q => levels[3].push(q));
newL4.forEach(q => levels[4].push(q));

console.log('\nFinal counts:');
for(let i=1; i<=4; i++){
  const texts = levels[i].map(c => c.q);
  const unique = new Set(texts);
  console.log(`  Level ${i}: ${levels[i].length} cards, ${unique.size} unique${texts.length === unique.size ? ' ✓' : ' ✗ DUPES!'}`);
}

// Write back
let output = '';
for(let lvl=1; lvl<=4; lvl++){
  for(const card of levels[lvl]){
    if(card.raw){
      output += card.raw + ',\n';
    } else {
      // Reconstruct from existing
      output += `  {level:${lvl}, q:'${card.q}', a:[${card.answers}]},\n`;
    }
  }
}

const newArray = 'const KIDS_QUIZ_CARDS = [\n' + output + '];';
content = content.replace(/const KIDS_QUIZ_CARDS = \[[\s\S]*?\];/, newArray);
fs.writeFileSync(file, content);
console.log('\nFile written successfully!');
