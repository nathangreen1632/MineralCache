// Client/src/AppRoutes.tsx
import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import HomePage from './pages/HomePage';

// Auth
import LoginPage from './pages/LoginPage';
import AgeVerifyPage from './pages/auth/AgeVerifyPage';

// Public catalog
import ProductList from './pages/products/ProductList';
import ProductDetail from './pages/products/ProductDetail';

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
        <Route path="verify-age" element={<AgeVerifyPage />} />
        <Route path="products" element={<ProductList />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />

        {/* Orders */}
        <Route path="orders/confirmation" element={<OrderConfirmationPage />} />
        <Route path="account/orders" element={<MyOrdersPage />} />
        <Route path="account/orders/:id" element={<OrderDetailPage />} />
        <Route path="/orders/:id/receipt" element={<Receipt />} />

        {/* Vendor */}
        <Route path="vendor/apply" element={<VendorApply />} />
        <Route path="vendor/dashboard" element={<VendorDashboard />} />
        <Route path="vendor/products" element={<VendorProductsPage />} />
        <Route path="vendor/orders" element={<VendorOrdersPage />} />
        <Route path="vendor/payouts" element={<PayoutsPage />} />

        {/* Admin */}
        <Route path="admin/vendor-apps" element={<AdminVendorApps />} />
        <Route path="admin/orders" element={<AdminOrders />} />
        <Route path="admin/orders/:id" element={<AdminOrderDetail />} />
        <Route path="admin/settings" element={<AdminSettings />} />

        {/* Vendor product CRUD */}
        <Route path="products/new" element={<ProductCreate />} />
        <Route path="products/:id/edit" element={<ProductEdit />} />

        {/* Fallback */}
        <Route path="*" element={<div>Not found.</div>} />
      </Route>
    </Routes>
  );
}
