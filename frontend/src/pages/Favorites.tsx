import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';

interface FavoriteProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  slug: string;
}

export default function Favorites() {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    const stored = localStorage.getItem('yesyes-favorites');
    if (stored) {
      setFavorites(JSON.parse(stored));
    }
  }, []);

  const removeFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      localStorage.setItem('yesyes-favorites', JSON.stringify(next));
      return next;
    });
    toast.success('Eliminado de favoritos');
  };

  const handleAdd = (product: FavoriteProduct) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      stock: 10,
      providerPrice: 0,
    });
    toast.success('Producto agregado al carrito');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Mis Favoritos</h1>
        {favorites.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Heart className="w-16 h-16 text-gray-300 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">No tienes favoritos aún</h2>
            <p className="text-gray-500">Explora nuestra tienda y agrega productos que te gusten.</p>
            <Link to="/productos" className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 transition-all">
              <ShoppingBag className="w-5 h-5 mr-2" />
              Ver Productos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {favorites.map((product) => (
              <motion.div
                key={product.id}
                layout
                className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden group"
              >
                <Link to={`/productos/${product.slug}`} className="block relative overflow-hidden aspect-square">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </Link>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-gray-800 line-clamp-2">{product.name}</h3>
                  <p className="text-lg font-bold text-primary-600">${product.price.toLocaleString('es-CL')}</p>
                  <div className="flex space-x-2">
                    <button onClick={() => handleAdd(product)} className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Agregar
                    </button>
                    <button onClick={() => removeFavorite(product.id)} className="p-2 text-red-500 hover:text-red-700 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
