import { MercadoPagoConfig, Preference, WebhookSignatureValidator } from 'mercadopago';

// En Vercel serverless NO hay archivo .env: las variables las inyecta el runtime
// directamente en process.env. Por eso se lee process.env directamente (sin dotenv).
const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

let mpClient: MercadoPagoConfig | null = null;
let preferenceClient: Preference | null = null;

if (accessToken) {
  mpClient = new MercadoPagoConfig({ accessToken });
  preferenceClient = new Preference(mpClient);
}

export { WebhookSignatureValidator };

export const getPublicKey = (): string => {
  if (!publicKey) {
    throw new Error('MERCADOPAGO_PUBLIC_KEY is not defined');
  }
  return publicKey;
};

export const getWebhookSecret = (): string => {
  if (!webhookSecret) {
    throw new Error('MERCADOPAGO_WEBHOOK_SECRET is not defined');
  }
  return webhookSecret;
};

export const getPreferenceClient = (): Preference => {
  if (!preferenceClient) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN is not defined');
  }
  return preferenceClient;
};
