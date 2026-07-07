import fs from 'fs';
import path from 'path';

const configPath = path.join(__dirname, 'aiConfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Restore usernames by removing (C4 ) and (RV )
for (const game of Object.keys(config)) {
  for (const botKey of Object.keys(config[game])) {
    const bot = config[game][botKey];
    bot.username = bot.username.replace(/\(C4 /, '(').replace(/\(RV /, '(').replace(/ \(C4\)$/, '').replace(/ \(RV\)$/, '');
  }
}

// Map from username -> id
const usernameToId = new Map<string, string>();

for (const game of Object.keys(config)) {
  for (const botKey of Object.keys(config[game])) {
    const bot = config[game][botKey];
    if (usernameToId.has(bot.username)) {
      bot.id = usernameToId.get(bot.username);
    } else {
      usernameToId.set(bot.username, bot.id);
    }
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Fixed aiConfig.json bot IDs and usernames');
