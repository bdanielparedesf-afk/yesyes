import api from '@/lib/axios';

export interface MercadoPagoStatus {
  connected: boolean;
  status: string;
  mpUserId?: string | null;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  expiresAt?: string | null;
  sandbox?: boolean;
}

export async function getMercadoPagoStatus(businessId: string): Promise<MercadoPagoStatus> {
  const { data } = await api.get(`/api/businesses/${businessId}/mercadopago`);
  return data;
}

export async function startMercadoPagoConnection(businessId: string): Promise<{ authorizationUrl: string }> {
  const { data } = await api.post(`/api/businesses/${businessId}/mercadopago/connect`);
  return data;
}

export async function disconnectMercadoPago(businessId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/api/businesses/${businessId}/mercadopago`);
  return data;
}
