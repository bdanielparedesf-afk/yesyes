/**
 * Disabled until the refresh parameter/signing contract is verified.
 * The old implementation sent credentials in a URL, logged provider messages,
 * and was incompatible with encrypted token storage. Never execute it against
 * either legacy plaintext or new encrypted records.
 */
export async function refreshAliexpressToken(): Promise<boolean> {
  throw new Error('ALIEXPRESS_REFRESH_CONTRACT_NOT_VERIFIED');
}

