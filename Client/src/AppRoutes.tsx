// Client/src/AppRoutes.tsx
import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LegalPage from "./pages/LegalPage.tsx";

// Auth
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import AgeVerifyPage from './pages/auth/AgeVerifyPage';
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

// Public catalog
import ProductShopList from './pages/products/ProductShopList.tsx';
import ProductDetail from './pages/products/ProductDetail';
import CategoryPage from './pages/CategoryPage';

// Auctions (public + vendor create)
import AuctionsListPage from './pages/auctions/AuctionsListPage';
import AuctionDetailPage from './pages/auctions/AuctionDetailPage';
import AuctionCreatePage from './pages/auctions/AuctionCreatePage';
import EditAuctionPage from './pages/auctions/EditAuctionPage';
import AuctionWatchPage from './pages/auctions/AuctionWatchPage';


// Vendor
import VendorApply from './pages/VendorApply';
import VendorDashboard from './pages/vendor/VendorDashboard';
import VendorMainPage from './pages/vendor/VendorMainPage';
import VendorProductsPage from './pages/vendor/VendorProductsPage';
import VendorOrdersPage from './pages/vendor/VendorOrdersPage';
import VendorPayoutsPage from './pages/vendor/VendorPayoutsPage';

// Admin
import AdminVendorApps from './pages/admin/AdminVendorApps';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAuctionsPage from './pages/admin/AdminAuctionsPage';

// Vendor product CRUD
import ProductCreate from './pages/products/ProductCreate';
import ProductEdit from './pages/products/ProductEdit';

// Cart & Checkout
import CartPage from './pages/cart/CartPage';
import CheckoutPage from './pages/cart/CheckoutPage';
import Receipt from './pages/orders/Receipt';

// Orders
import OrderConfirmationPage from './pages/orders/OrderConfirmationPage';
import MyOrdersPage from './pages/orders/MyOrdersPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';

// Age gate banner (mounted globally)
import AgeGateNotice from './components/AgeGateNotice';

// Guards
import RequireAuth from './routes/RequireAuth';
import RequireRole from './routes/RequireRole';

const AUCTIONS_ENABLED =
  String(import.meta.env.VITE_AUCTIONS_ENABLED || '').toLowerCase() === 'true';

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
        <Route index element={<HomePage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-age" element={<AgeVerifyPage />} />
        <Route path="products" element={<ProductShopList />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="/vendors/:slug" element={<VendorMainPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {AUCTIONS_ENABLED && (
          <>
            <Route path="auctions" element={<AuctionsListPage />} />
            <Route path="auctions/watchlist" element={<AuctionWatchPage />} />
            <Route path="auctions/:id" element={<AuctionDetailPage />} />
            <Route path="auctions/:id/edit" element={<EditAuctionPage />} />
          </>
        )}

        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />

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
        {AUCTIONS_ENABLED && (
          <Route
            path="vendor/auctions/new"
            element={
              <RequireRole role="vendor">
                <AuctionCreatePage />
              </RequireRole>
            }
          />
        )}
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
              <VendorPayoutsPage />
            </RequireRole>
          }
        />

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
        <Route path="*" element={<div>Not found.</div>} />
      </Route>
    </Routes>
  );
}
