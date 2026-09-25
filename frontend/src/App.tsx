import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/layouts/Layout';
// Solo Home va eager: es la primera pantalla (LCP). Todo lo demás es lazy
// para que el JS inicial sea mínimo y el primer paint llegue rápido.
// React Router solo descarga el chunk de la ruta visitada.
import Home from '@/pages/Home';
import AdminLayout from '@/components/admin/AdminLayout';
// Code splitting: páginas pesadas o de uso admin se cargan bajo demanda para
// reducir el JS inicial de la tienda pública. Home/Catálogo/Producto/Carrito
// permanecen en el bundle inicial (LCP sin cadenas de lazy).
const Products = lazy(() => import('@/pages/Products'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Category = lazy(() => import('@/pages/Category'));
const Cart = lazy(() => import('@/pages/Cart'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const RecuperarPassword = lazy(() => import('@/pages/RecuperarPassword'));
const VerificarEmail = lazy(() => import('@/pages/VerificarEmail'));
const Profile = lazy(() => import('@/pages/Profile'));
const Orders = lazy(() => import('@/pages/Orders'));
const OrderDetail = lazy(() => import('@/pages/OrderDetail'));
const Favorites = lazy(() => import('@/pages/Favorites'));
const Contact = lazy(() => import('@/pages/Contact'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const Legal = lazy(() => import('@/pages/Legal'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const Admin = lazy(() => import('@/pages/Admin'));
const AdminProducts = lazy(() => import('@/pages/AdminProducts'));
const AdminOrders = lazy(() => import('@/pages/AdminOrders'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const AdminImport = lazy(() => import('@/pages/AdminImport'));
const AdminBulk = lazy(() => import('@/pages/AdminBulk'));
const AdminAliExpress = lazy(() => import('@/pages/AdminAliExpress'));
const AdminBusinesses = lazy(() => import('@/pages/AdminBusinesses'));
const AdminBusinessEditor = lazy(() => import('@/pages/AdminBusinessEditor'));
const MiNegocio = lazy(() => import('@/pages/MiNegocio'));
const BusinessDashboard = lazy(() => import('@/pages/BusinessDashboard'));
const BusinessBuilder = lazy(() => import('@/pages/BusinessBuilder'));
const BusinessWizard = lazy(() => import('@/pages/BusinessWizard'));
const PropertyDetail = lazy(() => import('@/pages/PropertyDetail'));
const PaymentResult = lazy(() => import('@/pages/PaymentResult'));
const BusinessFixturePage = import.meta.env.DEV ? lazy(() => import('@/pages/BusinessFixturePage')) : null;

function Ofertas() {
  return <Navigate to="/productos?filter=ofertas" replace />;
}

function App() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-pulse text-neutral-500">Cargando…</div>
      </div>
    }>
    <Routes>
      {/* Tienda pública con Header/Footer */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="productos" element={<Products />} />
        <Route path="productos/:slug" element={<ProductDetail />} />
        <Route path="producto/:slug" element={<Navigate to="/productos" replace />} />
        <Route path="categoria/:slug" element={<Category />} />
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
      <Route path="/admin/aliexpress" element={<AdminLayout><AdminAliExpress /></AdminLayout>} />
      <Route path="/admin/negocios" element={<AdminLayout><AdminBusinesses /></AdminLayout>} />
      <Route path="/admin/negocios/:id/editor" element={<AdminLayout><AdminBusinessEditor /></AdminLayout>} />
      <Route path="/mi-negocio/:slug" element={<MiNegocio />} />
      {BusinessFixturePage && <Route path="/__qa/business/:category" element={<BusinessFixturePage />} />}
      <Route path="/mi-negocio/:slug/propiedad/:propertyId" element={<PropertyDetail />} />
      <Route path="/negocio/nuevo" element={<BusinessWizard />} />
      <Route path="/negocio/editor" element={<BusinessBuilder />} />
      <Route path="/negocio" element={<BusinessDashboard />} />
      <Route path="/negocio/dashboard" element={<BusinessDashboard />} />
      <Route path="/negocio/configuracion" element={<BusinessDashboard section="configuracion" />} />
      <Route path="/negocio/servicios" element={<BusinessDashboard section="servicios" />} />
      <Route path="/negocio/productos" element={<BusinessDashboard section="productos" />} />
      <Route path="/negocio/propiedades" element={<BusinessDashboard section="propiedades" />} />
      <Route path="/negocio/galeria" element={<BusinessDashboard section="galeria" />} />
      <Route path="/negocio/diseno" element={<BusinessDashboard section="diseno" />} />
      <Route path="/negocio/contenido" element={<BusinessDashboard section="contenido" />} />
      <Route path="/negocio/reservas" element={<BusinessDashboard section="reservas" />} />
      <Route path="/negocio/leads" element={<BusinessDashboard section="leads" />} />
      <Route path="/admin/import-aliexpress" element={<Navigate to="/admin/aliexpress" replace />} />
    </Routes>
    </Suspense>
  );
}

export default App;
