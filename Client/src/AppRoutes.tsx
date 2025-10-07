// Client/src/AppRoutes.tsx
import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import HomePage from './pages/HomePage';

// Auth
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AgeVerifyPage from './pages/auth/AgeVerifyPage';

// Public catalog
import ProductList from './pages/products/ProductList';
import ProductDetail from './pages/products/ProductDetail';
import CategoryPage from './pages/CategoryPage'; // ← NEW

// Vendor
import VendorApply from './pages/VendorApply';
import VendorDashboard from './pages/vendor/VendorDashboard';
import VendorProductsPage from './pages/vendor/VendorProductsPage';
import VendorOrdersPage from './pages/vendor/VendorOrdersPage';
import PayoutsPage from './pages/vendor/PayoutsPage';

// Admin
import AdminVendorApps from './pages/admin/AdminVendorApps';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAuctionsPage from './pages/admin/AdminAuctionsPage'; // ✅ NEW

// Vendor product CRUD
import ProductCreate from './pages/products/ProductCreate';
import ProductEdit from './pages/products/ProductEdit';

// Cart & Checkout
import CartPage from './pages/cart/CartPage';
import CheckoutPage from './pages/cart/CheckoutPage';
import Receipt from './pages/orders/Receipt.tsx';

// Orders
import OrderConfirmationPage from './pages/orders/OrderConfirmationPage';
import MyOrdersPage from './pages/orders/MyOrdersPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';

// Age gate banner (mounted globally)
import AgeGateNotice from './components/AgeGateNotice';

// ✅ Guards
import RequireAuth from './routes/RequireAuth';
import RequireRole from './routes/RequireRole';

function WithAgeGate(): React.ReactElement {
  return (
    <>
      <AgeGateNotice />
      <Outlet />
    </>
  );
}

export default function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route element={<WithAgeGate />}>
        {/* Public */}
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-age" element={<AgeVerifyPage />} />
        <Route path="products" element={<ProductList />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />

        {/* Orders */}
        <Route path="orders/confirmation" element={<OrderConfirmationPage />} />
        <Route
          path="account/orders"
          element={
            <RequireAuth>
              <MyOrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="account/orders/:id"
          element={
            <RequireAuth>
              <OrderDetailPage />
            </RequireAuth>
          }
        />
        <Route path="/orders/:id/receipt" element={<Receipt />} />

        {/* Vendor */}
        <Route
          path="vendor/apply"
          element={
            <RequireAuth>
              <VendorApply />
            </RequireAuth>
          }
        />
        <Route
          path="vendor/dashboard"
          element={
            <RequireRole role="vendor">
              <VendorDashboard />
            </RequireRole>
          }
        />
        <Route
          path="vendor/products"
          element={
            <RequireRole role="vendor">
              <VendorProductsPage />
            </RequireRole>
          }
        />
        <Route
          path="vendor/orders"
          element={
            <RequireRole role="vendor">
              <VendorOrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="vendor/payouts"
          element={
            <RequireRole role="vendor">
              <PayoutsPage />
            </RequireRole>
          }
        />

        {/* Admin */}
        <Route
          path="admin/vendor-apps"
          element={
            <RequireRole role="admin">
              <AdminVendorApps />
            </RequireRole>
          }
        />
        <Route
          path="admin/orders"
          element={
            <RequireRole role="admin">
              <AdminOrders />
            </RequireRole>
          }
        />
        <Route
          path="admin/orders/:id"
          element={
            <RequireRole role="admin">
              <AdminOrderDetail />
            </RequireRole>
          }
        />
        <Route
          path="admin/auctions"
          element={
            <RequireRole role="admin">
              <AdminAuctionsPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/settings"
          element={
            <RequireRole role="admin">
              <AdminSettings />
            </RequireRole>
          }
        />

        {/* Vendor product CRUD */}
        <Route
          path="products/new"
          element={
            <RequireRole role="vendor">
              <ProductCreate />
            </RequireRole>
          }
        />
        <Route
          path="products/:id/edit"
          element={
            <RequireRole role="vendor">
              <ProductEdit />
            </RequireRole>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<div>Not found.</div>} />
      </Route>
    </Routes>
  );
}
