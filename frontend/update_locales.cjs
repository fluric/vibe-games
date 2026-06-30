const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all tsx files
const files = execSync('find src -name "*.tsx"').toString().split('\n').filter(Boolean);

const regex = /t\(['"]([a-zA-Z0-9_.]+)['"],\s*\{\s*defaultValue:\s*['"](.*?)['"]/g;
const translations = { lobby: {}, game: {}, escape: {} };

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const keyPath = match[1];
    let val = match[2];
    
    // Determine namespace
    let ns = 'lobby';
    if (keyPath.startsWith('ui.')) {
      ns = 'escape';
    } else if (file.includes('GamePage')) {
      ns = 'game';
    }
    
    translations[ns][keyPath] = val;
  }
});

const localesDir = path.join(__dirname, 'src/i18n/locales');
const langs = ['en', 'de', 'fr', 'es'];

langs.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  let data = {};
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  
  for (const ns of Object.keys(translations)) {
    if (!data[ns]) data[ns] = {};
    for (const [key, val] of Object.entries(translations[ns])) {
      if (!data[ns][key]) {
        // If it's not English, we should append a translated version ideally, but we can just use AI to translate later or translate them programmatically.
        // For now, let's just populate them with the default value so we have the keys.
        data[ns][key] = val;
      }
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
});

console.log("Updated locales.");
