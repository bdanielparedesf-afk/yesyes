import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/layouts/Layout';
import Home from '@/pages/Home';
import Products from '@/pages/Products';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import RecuperarPassword from '@/pages/RecuperarPassword';
import VerificarEmail from '@/pages/VerificarEmail';
import Profile from '@/pages/Profile';
import Orders from '@/pages/Orders';
import OrderDetail from '@/pages/OrderDetail';
import Favorites from '@/pages/Favorites';
import Contact from '@/pages/Contact';
import FAQ from '@/pages/FAQ';
import Legal from '@/pages/Legal';
import Admin from '@/pages/Admin';
import AdminProducts from '@/pages/AdminProducts';
import AdminOrders from '@/pages/AdminOrders';
import AdminUsers from '@/pages/AdminUsers';
import AdminImport from '@/pages/AdminImport';
import AdminBulk from '@/pages/AdminBulk';
import AdminLayout from '@/components/admin/AdminLayout';
import NotFound from '@/pages/NotFound';
import PaymentResult from '@/pages/PaymentResult';

function Ofertas() {
  return <Navigate to="/productos?filter=ofertas" replace />;
}

function App() {
  return (
    <Routes>
      {/* Tienda pública con Header/Footer */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="productos" element={<Products />} />
        <Route path="productos/:slug" element={<ProductDetail />} />
        <Route path="categoria/:slug" element={<Products />} />
        <Route path="categoria/:nombre" element={<Products />} />
        <Route path="producto/:slug" element={<Navigate to="/productos/:slug" replace />} />
        <Route path="buscar" element={<Products />} />
        <Route path="ofertas" element={<Ofertas />} />
        <Route path="carrito" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="payment/success" element={<PaymentResult kind="success" />} />
        <Route path="payment/failure" element={<PaymentResult kind="failure" />} />
        <Route path="payment/pending" element={<PaymentResult kind="pending" />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="registro" element={<Navigate to="/register" replace />} />
        <Route path="recuperar-password" element={<RecuperarPassword />} />
        <Route path="verificar-email" element={<VerificarEmail />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="mis-pedidos" element={<Orders />} />
        <Route path="pedido/:id" element={<OrderDetail />} />
        <Route path="favoritos" element={<Favorites />} />
        <Route path="contacto" element={<Contact />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="terminos" element={<Legal kind="terminos" />} />
        <Route path="privacidad" element={<Legal kind="privacidad" />} />
        <Route path="cookies" element={<Legal kind="cookies" />} />
        <Route path="envios" element={<Legal kind="envios" />} />
        <Route path="devoluciones" element={<Legal kind="devoluciones" />} />
        <Route path="garantia" element={<Legal kind="garantia" />} />
        <Route path="reembolsos" element={<Legal kind="reembolsos" />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin - fuera del Layout de tienda, con sidebar oscuro */}
      <Route path="/admin" element={<AdminLayout><Admin /></AdminLayout>} />
      <Route path="/admin/products" element={<AdminLayout><AdminProducts /></AdminLayout>} />
      <Route path="/admin/orders" element={<AdminLayout><AdminOrders /></AdminLayout>} />
      <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
      <Route path="/admin/import-cj" element={<AdminLayout><AdminImport /></AdminLayout>} />
      <Route path="/admin/bulk" element={<AdminLayout><AdminBulk /></AdminLayout>} />
      {/* Compatibilidad: rutas antiguas de importación */}
      <Route path="/admin/import" element={<Navigate to="/admin/import-cj" replace />} />
      <Route path="/admin/bulk-import" element={<Navigate to="/admin/bulk" replace />} />
      <Route path="/admin/import-aliexpress" element={<Navigate to="/admin/import-cj" replace />} />
    </Routes>
  );
}

export default App;
