// Local configuration check only. No AliExpress request or credential validation.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const dotenv = require('dotenv');

function diagnose(environment) {
  const credentialsConfigured = Boolean(
    environment.ALIEXPRESS_APP_KEY?.trim() && environment.ALIEXPRESS_APP_SECRET?.trim(),
  );
  return {
    check: 'LOCAL_PREFLIGHT_ONLY',
    credentialsConfigured,
    requestAttempted: false,
    connected: false,
    authenticated: false,
    authorized: false,
    apiAvailable: false,
    status: 'BLOCKED',
    reason: credentialsConfigured
      ? 'OFFICIAL_API_CONTRACT_AND_APP_PERMISSIONS_NOT_VERIFIED'
      : 'MISSING_CREDENTIALS',
    // False means not verified, not that AliExpress rejected these credentials.
    verification: 'NOT_PERFORMED',
  };
}

if (require.main === module) {
  let local = {};
  try {
    local = dotenv.parse(readFileSync(resolve(__dirname, '../.env')));
  } catch {
    // Never print filesystem errors or environment contents.
  }
  const result = diagnose({ ...local, ...process.env });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = 2;
}

module.exports = { diagnose };
