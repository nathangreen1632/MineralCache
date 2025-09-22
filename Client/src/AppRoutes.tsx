// Client/src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import VendorApply from './pages/VendorApply';
import VendorDashboard from './pages/VendorDashboard';
import AdminVendorApps from './pages/admin/AdminVendorApps';
import ProductCreate from './pages/products/ProductCreate';
import ProductEdit from './pages/products/ProductEdit';

// Public catalog
import ProductList from './pages/products/ProductList';
import ProductDetail from './pages/products/ProductDetail';

export default function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      {/* Public */}
      <Route index element={<HomePage />} />
      <Route path="products" element={<ProductList />} />
      <Route path="products/:id" element={<ProductDetail />} />

      {/* Vendor */}
      <Route path="vendor/apply" element={<VendorApply />} />
      <Route path="vendor/dashboard" element={<VendorDashboard />} />

      {/* Admin */}
      <Route path="admin/vendor-apps" element={<AdminVendorApps />} />

      {/* Vendor product CRUD */}
      <Route path="products/new" element={<ProductCreate />} />
      <Route path="products/:id/edit" element={<ProductEdit />} />

      {/* Fallback */}
      <Route path="*" element={<div>Not found.</div>} />
    </Routes>
  );
}
