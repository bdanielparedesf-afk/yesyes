export default function BusinessLayout({ business, children }: { business: any; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {business?.logo && <img src={business.logo} alt={business.name} className="w-10 h-10 rounded-full object-cover" />}
          <div>
            <p className="font-bold leading-tight">{business?.name}</p>
            {business?.city && <p className="text-xs text-neutral-500">{business.city}</p>}
          </div>
        </div>
      </header>
      {/*
        La portada (cover) la pinta cada plantilla dentro de su propio hero
        (evita portada duplicada: layout + hero de plantilla).
      */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10">{children}</main>
      <footer className="border-t bg-white mt-10">
        <div className="max-w-5xl mx-auto px-4 py-6 text-sm text-neutral-500">
          {business?.address && <p>{business.address}{business?.city ? `, ${business.city}` : ''}</p>}
          {business?.phone && <p>Tel: {business.phone}</p>}
          <p className="mt-2">Publicado en YesYes</p>
        </div>
      </footer>
    </div>
  );
}
