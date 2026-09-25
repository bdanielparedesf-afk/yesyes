import api from '@/lib/axios';

export interface CartItemAPI {
  id?: string;
  productId: string;
  title?: string;
  description?: string;
  price?: number;
  variantId?: string | null;
  quantity: number;
  image?: string;
}

export interface PayerAPI {
  name: string;
  surname: string;
  email: string;
  phone?: {
    area_code: string;
    number: string;
  };
  identification?: {
    type: string;
    number: string;
  };
}

export interface ShippingAddressAPI {
  address: string;
  city: string;
  zip: string;
}

export interface CreatePreferenceRequest {
  items: CartItemAPI[];
  payer?: PayerAPI;
  shippingAddress?: ShippingAddressAPI;
  /** Kept only for backward-compatible clients; the backend recalculates it. */
  total?: number;
}

export interface CreatePreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  public_key: string;
  orderId: string;
}

export const createPaymentPreference = async (data: CreatePreferenceRequest): Promise<CreatePreferenceResponse> => {
  const response = await api.post('/payments/create-preference', data);
  return response.data;
};
