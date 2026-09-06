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
import Profile from '@/pages/Profile';
import Orders from '@/pages/Orders';
import OrderDetail from '@/pages/OrderDetail';
import Favorites from '@/pages/Favorites';
import Contact from '@/pages/Contact';
import FAQ from '@/pages/FAQ';
import Admin from '@/pages/Admin';
import AdminImport from '@/pages/AdminImport';
import NotFound from '@/pages/NotFound';

function Ofertas() {
  return <Navigate to="/productos?filter=ofertas" replace />;
}

function App() {
  return (
    <Routes>
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
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="registro" element={<Navigate to="/register" replace />} />
        <Route path="recuperar-password" element={<RecuperarPassword />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="mis-pedidos" element={<Orders />} />
        <Route path="pedido/:id" element={<OrderDetail />} />
        <Route path="favoritos" element={<Favorites />} />
      <Route path="contacto" element={<Contact />} />
      <Route path="faq" element={<FAQ />} />
      <Route path="terminos" element={<FAQ />} />
      <Route path="privacidad" element={<FAQ />} />
      <Route path="cookies" element={<FAQ />} />
      <Route path="envios" element={<FAQ />} />
      <Route path="devoluciones" element={<FAQ />} />
      <Route path="reembolsos" element={<FAQ />} />
      <Route path="admin" element={<Admin />} />
      <Route path="admin/import" element={<AdminImport />} />
      <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
