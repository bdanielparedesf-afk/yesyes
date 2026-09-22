export default function Gallery({ images }: { images: { url: string; alt?: string | null }[] }) {
  if (!images?.length) return null;
  return (
    <section>
      <h2 className="text-xl font-bold mb-3">Galería</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((img, i) => (
          <img key={i} src={img.url} alt={img.alt || `Foto ${i + 1}`} className="w-full h-40 object-cover rounded-xl" loading="lazy" />
        ))}
      </div>
    </section>
  );
}
