import { MercadoPagoConfig, Preference, WebhookSignatureValidator } from 'mercadopago';

// En Vercel serverless NO hay archivo .env: las variables las inyecta el runtime
// directamente en process.env. Se leen de forma DINÁMICA (dentro de las funciones)
// para evitar que el módulo se cargue antes de que el runtime inyecte las variables.
let _mpClient: MercadoPagoConfig | null = null;
let _preferenceClient: Preference | null = null;

const getAccessToken = (): string | undefined => process.env.MERCADOPAGO_ACCESS_TOKEN;
const getPublicKeyValue = (): string | undefined => process.env.MERCADOPAGO_PUBLIC_KEY;
const getWebhookSecretValue = (): string | undefined => process.env.MERCADOPAGO_WEBHOOK_SECRET;

const buildClient = (): void => {
  const token = getAccessToken();
  if (token) {
    _mpClient = new MercadoPagoConfig({ accessToken: token });
    _preferenceClient = new Preference(_mpClient);
  }
};

export { WebhookSignatureValidator };

export const getPublicKey = (): string => {
  // La public key ES OPCIONAL para crear la preferencia de pago (solo la usa el
  // SDK/Bricks de Mercado Pago en el frontend, y donde pagamos redirigimos a
  // init_point). Si no está configurada en Vercel, devolvemos '' en vez de
  // lanzar un error que rompa el checkout.
  return getPublicKeyValue() || '';
};

export const getWebhookSecret = (): string => {
  const secret = getWebhookSecretValue();
  if (!secret) {
    throw new Error('MERCADOPAGO_WEBHOOK_SECRET is not defined');
  }
  return secret;
};

export const getPreferenceClient = (): Preference => {
  if (!_preferenceClient) {
    buildClient();
  }
  if (!_preferenceClient) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN is not defined');
  }
  return _preferenceClient;
};
