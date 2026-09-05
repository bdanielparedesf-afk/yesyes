import { MercadoPagoConfig, Preference, WebhookSignatureValidator } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

if (!accessToken) {
  throw new Error('MERCADOPAGO_ACCESS_TOKEN is not defined');
}

export const mpClient = new MercadoPagoConfig({
  accessToken,
});

export const preferenceClient = new Preference(mpClient);

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
