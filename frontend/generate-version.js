const fs = require('fs');
const path = require('path');

// If APP_VERSION is set, use it (e.g., 2.0.0). Else, generate timestamp version.
const now = new Date();
const version = process.env.APP_VERSION || `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

// Write to version.json
const versionFile = path.join(__dirname, 'public', 'version.json');
const versionData = {
  version: version,
  buildDate: now.toISOString()
};

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
console.log(`Version generated: ${version}`);
