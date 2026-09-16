// Safe compatibility entry point: credentials come only from the private environment.
// Never exchanges/refreshes tokens, creates orders, or prints provider payloads.
require('./aliexpress-dropship-probe.cjs').main().catch(() => {
  console.log(JSON.stringify({ status: 'BLOCKED', reason: 'PRIVATE_CONFIGURATION_OR_TOKEN_UNAVAILABLE' }));
  process.exitCode = 1;
});
export {};