import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { Download, Upload, Loader2, CheckSquare } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { cleanDescription, translateToSpanish } from '@/lib/html-utils';

// FASE 4C — Importación masiva CJ vía Excel (ruta /admin/bulk).
// 1) Descargar plantilla .xlsx (link | categoria, 50 filas)
// 2) Subir excel → preview masivo editable (POST /api/scrape/cj/bulk-preview)
// 3) Marcar filas → importar seleccionadas (POST /api/admin/products/bulk-create)

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';
const MAX_LINKS = 50;

interface PreviewRow {
  link: string;
  sourceId: string;
  titleEs: string;
  description?: string;
  costUsd: number;
  priceClp: number;
  images: string[];
  category: string;
  status: string;
  error?: string;
}

interface RowUI extends PreviewRow {
  checked: boolean;
  editedTitle: string;
  editedPrice: number;
  editedCategory: string;
  editedDescription?: string;
}

export default function AdminBulk() {
  const { user } = useAuthStore();
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL || user?.role === 'ADMIN';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<RowUI[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dollarRate, setDollarRate] = useState(950);
  const [bulkMargin, setBulkMargin] = useState(2); // default 2 = 100% (x2), same as single importer
  const marginOptions = [
    { value: 1.5, label: '50% (x1.5)' },
    { value: 2, label: '100% (x2)' },
    { value: 2.5, label: '150% (x2.5)' },
    { value: 3, label: '200% (x3)' },
    { value: 4, label: '300% (x4)' },
  ];

  // 1) Descargar plantilla
  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/admin/products/template-excel', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-links-cj.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Plantilla descargada');
    } catch {
      toast.error('Error al descargar la plantilla');
    } finally {
      setDownloading(false);
    }
  };

  // 2) Parsear Excel con SheetJS
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

      const links: { link: string; category: string }[] = [];
      for (const line of data.slice(1)) {
        if (!Array.isArray(line)) continue;
        const link = String(line[0] ?? '').trim();
        if (!link) continue;
        const category = String(line[1] ?? '').trim();
        links.push({ link, category });
        if (links.length >= MAX_LINKS) break;
      }

      if (!links.length) {
        toast.error('El Excel no tiene links en la columna A');
        setRows([]);
        return;
      }

      const initial: RowUI[] = links.map((l) => ({
        link: l.link,
        sourceId: '',
        titleEs: l.link,
        images: [],
        costUsd: 0,
        priceClp: 0,
        category: l.category || '',
        status: '',
        checked: true,
        editedTitle: '',
        editedPrice: 0,
        editedCategory: l.category || '',
      }));
      setRows(initial);
      setDollarRate(950);

      // Preview en backend (no crea productos)
      await runPreview(links);
      toast.success(`Excel leído: ${links.length} links`);
    } catch (error: any) {
      console.error('[AdminBulk] parse error:', error);
      toast.error('No pude leer el Excel. Usa la plantilla descargada (columnas link, categoria).');
      setRows([]);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
// Preview masivo con el backend (reutiliza FASE 4A, sin crear)
  const runPreview = async (links: { link: string; category: string }[]) => {
    setPreviewing(true);
    try {
      const res = await api.post('/scrape/cj/bulk-preview', {
        links: links.map((l) => ({ link: l.link, category: l.category })),
        margin: bulkMargin,
      });
      const data = res.data;
      if (data?.dollarRate) setDollarRate(data.dollarRate);
      const previewRows: PreviewRow[] = data?.results || [];
      setRows((prev) =>
        prev.map((row) => {
          const found = previewRows.find((p) => p.link === row.link);
          if (!found) return row;
          return {
            ...row,
            sourceId: found.sourceId,
            titleEs: found.titleEs,
            description: found.description,
            costUsd: found.costUsd,
            priceClp: found.priceClp,
            images: found.images,
            category: found.category,
            status: found.status,
            error: found.error,
            editedTitle: found.status === 'OK' ? found.titleEs : row.editedTitle,
            editedPrice: found.priceClp || row.editedPrice,
            editedCategory: found.category || row.editedCategory,
          };
        })
      );
      const ok = previewRows.filter((r) => r.status === 'OK').length;
      toast.success(`Preview: ${ok} OK · ${previewRows.length - ok} error(es)`);
    } catch (error: any) {
      console.error('[AdminBulk] preview error:', error);
      toast.error(error?.response?.data?.message || 'Error en el preview');
    } finally {
      setPreviewing(false);
    }
  };

    // Traducir títulos y descripciones al español
  const handleTranslateAll = async () => {
    setPreviewing(true);
    try {
      const results = await Promise.allSettled(
        rows.map(async (row) => {
          if (!row.checked || row.status !== 'OK') return row;
          try {
            const t = await translateToSpanish(row.editedTitle || row.titleEs || '');
            const d = await translateToSpanish(row.description || '');
            return { ...row, editedTitle: t || row.editedTitle, editedDescription: d || row.description };
          } catch {
            // Si la traducción falla para esta fila, mantenemos el original
            return row;
          }
        })
      );
      const updated = results.map((r, i) => (r.status === 'fulfilled' ? r.value : rows[i]));
      setRows(updated);
      toast.success('Títulos y descripciones traducidos');
    } catch {
      toast.error('Error al traducir');
    } finally {
      setPreviewing(false);
    }
  };

  const toggleRow = (index: number) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, checked: !r.checked } : r)));
  };

  const toggleAll = () => {
    setRows((prev) => {
      const allChecked = prev.every((r) => r.checked);
      return prev.map((r) => ({ ...r, checked: !allChecked }));
    });
  };

  const updateRow = (index: number, patch: Partial<RowUI>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const selectedCount = rows.filter((r) => r.checked && r.status === 'OK').length;

  // 3) Importar solo los seleccionados
  const handleImport = async () => {
    const selected = rows.filter((r) => r.checked && r.status === 'OK');
    if (!selected.length) {
      toast.error('Marca al menos una fila válida para importar.');
      return;
    }
    setImporting(true);
    try {
      const payload = selected.map((r) => ({
        link: r.link,
        sourceId: r.sourceId,
        titleEs: (r.editedTitle || r.titleEs || '').trim(),
        description: cleanDescription(r.editedDescription || r.description || r.titleEs || ''),
        costUsd: r.costUsd,
        priceClp: Number(r.editedPrice) || r.priceClp,
        images: r.images.slice(0, 5),
        category: (r.editedCategory || r.category || 'general').trim(),
      }));
      const res = await api.post('/admin/products/bulk-create', { products: payload });
      const data = res.data;
      toast.success(`Importados ${data.created} · ${data.failed} error(es)`);
      setRows((prev) =>
        prev.map((r) => {
          const idx = prev.indexOf(r);
          const result = data.results?.find((x: any) => x.index === idx + 1);
          return result?.ok ? { ...r, checked: false, status: 'IMPORTED' } : r;
        })
      );
    } catch (error: any) {
      console.error('[AdminBulk] import error:', error);
      toast.error(error?.response?.data?.message || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };
  if (!isAdmin) return null;
  const formatCLP = (n: number) => `$${Number(n || 0).toLocaleString("es-CL")}`;
  const formatUSD = (n: number) => `$${Number(n || 0).toFixed(2)}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Excel (CJ masivo)</h1>
        <p className="text-sm text-gray-500 mt-1">Sube un Excel con hasta 50 links de CJ.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={handleDownloadTemplate} disabled={downloading} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar Plantilla.xlsx
        </button>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer">
          {parsing || previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Subir Excel (50 links)
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
        </label>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Margen</label>
          <select
            value={bulkMargin}
            onChange={(e) => setBulkMargin(Number(e.target.value))}
            disabled={previewing || importing}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {marginOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {rows.length > 0 && rows.some((r) => r.status === "OK") && (
          <button onClick={handleTranslateAll} disabled={previewing} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
            Traducir titulos
          </button>
        )}
      </div>
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Preview de importacion</h2>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{rows.length} links</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={rows.every((r) => r.checked)} onChange={toggleAll} className="rounded border-gray-300" />
                Seleccionar todo
              </label>
              <button onClick={handleImport} disabled={importing || selectedCount === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                Importar {selectedCount} seleccionados
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Foto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titulo ES</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio venta CLP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={row.link + idx} className={row.checked && row.status === 'OK' ? 'bg-white' : row.status === 'Error' ? 'bg-red-50/50' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3"><input type="checkbox" checked={row.checked} onChange={() => toggleRow(idx)} className="rounded border-gray-300" /></td>
                    <td className="px-4 py-3">
                      {row.images?.[0] ? (<img src={row.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100" />) : (<div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">—</div>)}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <input value={row.editedTitle || ''} onChange={(e) => updateRow(idx, { editedTitle: e.target.value })} disabled={row.status !== 'OK'} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50" placeholder={row.titleEs || 'Titulo'} />
                      {row.description && <p className="text-xs text-gray-400 mt-1 truncate max-w-[250px]">{row.description}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatUSD(row.costUsd)}</div>
                      <div className="text-xs text-gray-500">{formatCLP(row.costUsd * dollarRate)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={row.editedPrice || ''} onChange={(e) => updateRow(idx, { editedPrice: Number(e.target.value) })} disabled={row.status !== 'OK'} className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50" />
                    </td>
                    <td className="px-4 py-3">
                      <input value={row.editedCategory || ''} onChange={(e) => updateRow(idx, { editedCategory: e.target.value })} disabled={row.status !== 'OK'} className="w-32 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50" />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'OK' && <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">OK</span>}
                      {row.status === 'Error' && <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full" title={row.error || 'Error'}>Error</span>}
                      {row.status === 'IMPORTED' && <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Importado</span>}
                      {!row.status && <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Pendiente</span>}
                      {row.error && row.status !== 'Error' && <p className="text-xs text-red-600 mt-1 max-w-[180px] truncate" title={row.error}>{row.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{selectedCount}</span> seleccionados | <span className="font-medium text-green-700">{rows.filter((r) => r.status === 'OK').length} OK</span> | <span className="font-medium text-red-700">{rows.filter((r) => r.status === 'Error').length} errores</span>
            </div>
            <button onClick={handleImport} disabled={importing || selectedCount === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
              Importar {selectedCount} seleccionados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
