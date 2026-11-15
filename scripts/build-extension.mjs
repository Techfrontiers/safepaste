import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const webDistDir = path.join(rootDir, 'apps', 'web', 'dist');
const extDir = path.join(rootDir, 'apps', 'extension');
const extDistDir = path.join(extDir, 'dist');

console.log('1/3 Building @safepaste/core and @safepaste/web...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

console.log('2/3 Preparing apps/extension/dist...');
if (fs.existsSync(extDistDir)) {
  fs.rmSync(extDistDir, { recursive: true, force: true });
}
fs.cpSync(webDistDir, extDistDir, { recursive: true });

console.log('3/3 Copying Chrome Manifest V3 extension files...');
for (const file of ['manifest.json', 'background.js', 'content.js']) {
  fs.copyFileSync(path.join(extDir, file), path.join(extDistDir, file));
}

console.log('Extension package ready at:', extDistDir);
