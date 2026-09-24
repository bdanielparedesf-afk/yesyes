import { useCallback, useEffect, useState } from 'react';
import { getBusinessBookings, updateBusinessBooking } from '@/services/business';

const STATUS: Record<string, string> = { PENDING: 'Pendiente', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada', COMPLETED: 'Completada', NO_SHOW: 'No asistió' };
export default function BookingsSection({ businessId }: { businessId: string }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => setBookings(await getBusinessBookings(businessId)), [businessId]);
  useEffect(() => { void load().catch(() => setMessage('No se pudieron cargar las reservas.')); }, [load]);
  const update = async (id: string, status: string) => {
    try { await updateBusinessBooking(businessId, id, status); setMessage('Reserva actualizada.'); await load(); }
    catch { setMessage('No se pudo actualizar la reserva.'); }
  };
  return <div className="space-y-4"><div><h2 className="text-lg font-bold">Reservas</h2><p className="text-sm text-neutral-500">Gestiona las solicitudes recibidas desde tu página.</p></div><p className="text-sm" role="status" aria-live="polite">{message}</p>
    {!bookings.length ? <p className="rounded-xl border bg-white p-8 text-center text-sm text-neutral-500">No hay reservas todavía.</p> : <ul className="space-y-2">{bookings.map((booking) => <li key={booking.id} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{booking.serviceName || 'Reserva'}</p><p className="text-sm text-neutral-600">{booking.name} · {new Date(booking.date).toLocaleDateString('es-CL')} · {booking.time}</p><p className="text-xs text-neutral-500">{[booking.phone, booking.email].filter(Boolean).join(' · ')}</p>{booking.message && <p className="mt-2 text-sm">{booking.message}</p>}</div><div className="flex items-center gap-2"><span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold">{STATUS[booking.status] || booking.status}</span><label className="sr-only" htmlFor={`status-${booking.id}`}>Cambiar estado de reserva</label><select id={`status-${booking.id}`} value={booking.status} onChange={(e) => update(booking.id, e.target.value)}>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></li>)}</ul>}
  </div>;
}
