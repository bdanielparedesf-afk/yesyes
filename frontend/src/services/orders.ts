import api from '@/lib/axios';

export interface CustomerOrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  shippingAddress: Record<string, unknown>;
  createdAt: string;
  orderItems: CustomerOrderItem[];
}

export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const { data } = await api.get<{ orders: CustomerOrder[] }>('/orders');
  return data.orders;
}

export async function getCustomerOrder(id: string): Promise<CustomerOrder> {
  const { data } = await api.get<{ order: CustomerOrder }>(`/orders/${encodeURIComponent(id)}`);
  return data.order;
}
