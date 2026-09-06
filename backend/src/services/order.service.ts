import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createOrder = async (data: {
  userId: string;
  items: {
    productId: string;
    productName: string;
    productImage: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variant?: any;
    variantId?: string;
  }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  shippingAddress: any;
}) => {
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: data.userId,
      status: 'PENDING_PAYMENT',
      items: data.items,
      subtotal: data.subtotal,
      shipping: data.shipping,
      discount: data.discount,
      total: data.total,
      shippingAddress: data.shippingAddress,
      orderItems: {
        create: data.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          price: item.unitPrice,
          variant: item.variant,
          variantId: item.variantId,
        })),
      },
    },
    include: {
      orderItems: true,
    },
  });

  return order;
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  return prisma.order.update({
    where: { id: orderId },
    data: { 
      status: status as any,
      updatedAt: new Date(),
    },
  });
};

export const getOrderById = async (orderId: string) => {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { 
      orderItems: true,
      user: true,
    },
  });
};

export const updateOrderPayment = async (orderId: string, paymentId: string) => {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      paymentId,
    },
  });
};
