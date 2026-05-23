const fs = require('fs');
const path = require('path');

const lockfilePath = path.join(__dirname, '../package-lock.json');

if (!fs.existsSync(lockfilePath)) {
  console.log('[emnapi-patch] No package-lock.json found. Skipping patch.');
  process.exit(0);
}

try {
  const lock = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  
  // Ensure lock.packages exists
  if (!lock.packages) {
    lock.packages = {};
  }

  console.log('[emnapi-patch] Applying @emnapi build dependency patches...');

  lock.packages['node_modules/@emnapi/runtime'] = {
    version: '1.10.0',
    resolved: 'https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.10.0.tgz',
    integrity: 'sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==',
    optional: true,
    dependencies: {
      '@emnapi/core': '^1.4.3'
    }
  };

  lock.packages['node_modules/@emnapi/core'] = {
    version: '1.10.0',
    resolved: 'https://registry.npmjs.org/@emnapi/core/-/core-1.10.0.tgz',
    integrity: 'sha512-yq6OkJ4p82CAfPl0u9mQebQHKPJkY7WrIuk205cTYnYe+k2Z8YBh11FrbRG/H6ihirqcacOgl2BIO8oyMQLeXw==',
    optional: true,
    dependencies: {
      '@emnapi/runtime': '^1.4.3'
    }
  };

  fs.writeFileSync(lockfilePath, JSON.stringify(lock, null, 2) + '\n');
  console.log('[emnapi-patch] Successfully patched package-lock.json for @emnapi.');
} catch (error) {
  console.error('[emnapi-patch] Error patching lockfile:', error);
}
