import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from './auth';

export async function requireBusinessOwner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'No autorizado' });
    return;
  }
  if (req.user.role === 'ADMIN') {
    next();
    return;
  }
  const businessId = String((req.params as any).businessId || (req.params as any).id || '');
  if (!businessId) {
    next();
    return;
  }
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
  if (!business) {
    res.status(404).json({ message: 'Negocio no encontrado' });
    return;
  }
  if (business.ownerId !== req.user.id) {
    res.status(403).json({ message: 'Prohibido: no eres dueno de este negocio' });
    return;
  }
  next();
}

export function ownerWhere(req: AuthRequest, businessId: string): { id: string; ownerId?: string } {
  if (req.user?.role === 'ADMIN') return { id: businessId };
  return { id: businessId, ownerId: req.user!.id };
}

export function requireBusinessAccess(req: AuthRequest, businessId: string) {
  return ownerWhere(req, businessId);
}
