import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import type { Product } from '@/services/products';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
}

export default function ProductGrid({ products, loading = false }: ProductGridProps) {
  const addItem = useCartStore((s) => s.addItem);

  const handleAdd = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      imageHover: product.imageHover,
      stock: product.stock,
      providerPrice: product.providerPrice,
    });
    toast.success('Producto agregado al carrito');
  };

  if (loading) {
    return     <div className="text-center py-12 text-[#4A2C3A]/60">Cargando productos...</div>;
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12 text-[#4A2C3A]/60">
        <p className="text-lg">No hay productos para mostrar</p>
        <Link
          to="/admin"
          className="inline-block mt-4 px-6 py-2 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-medium rounded-full transition-colors"
        >
          Ir a Admin
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      {products.map((product) => (
        <motion.div
          key={product.id}
          variants={item}
          whileHover={{ y: -4 }}
          className="bg-white rounded-[24px] shadow-sm hover:shadow-lg transition-all border border-[#FAD3E7] overflow-hidden group"
        >
          <Link to={`/productos/${product.slug}`} className="block relative overflow-hidden aspect-square">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300 absolute inset-0"
            />
            <img
              src={product.imageHover}
              alt={product.name}
              className="w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0"
            />
            {product.offer && (
              <span className="absolute top-3 left-3 bg-[#E8A0BF] text-white text-xs font-bold px-2 py-1 rounded-full">
                -20%
              </span>
            )}
          </Link>
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-[#4A2C3A] line-clamp-2">{product.name}</h3>
            <div className="flex items-center">
              <span className="text-xl font-bold text-[#E8A0BF]">
                ${product.price.toLocaleString('es-CL')}
              </span>
            </div>
            <button
              onClick={() => handleAdd(product)}
              className="w-full mt-2 px-4 py-2 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white text-sm font-medium rounded-full transition-colors"
            >
              Agregar
            </button>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
