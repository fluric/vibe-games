import fs from 'fs';
import path from 'path';

const configPath = path.join(__dirname, 'aiConfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

for (const key of Object.keys(config.connect_four)) {
  const bot = config.connect_four[key];
  if (!bot.username.includes('(C4')) {
    bot.username = bot.username.replace('(', '(C4 ');
  }
}

for (const key of Object.keys(config.reversi)) {
  const bot = config.reversi[key];
  if (!bot.username.includes('(RV')) {
    bot.username = bot.username.replace('(', '(RV ');
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Fixed aiConfig.json');
