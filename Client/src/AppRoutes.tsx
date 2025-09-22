// Client/src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import VendorApply from './pages/VendorApply';
import VendorDashboard from './pages/VendorDashboard';
import AdminVendorApps from './pages/admin/AdminVendorApps';
import ProductCreate from './pages/products/ProductCreate';
import ProductEdit from './pages/products/ProductEdit';

export default function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="vendor/apply" element={<VendorApply />} />
      <Route path="vendor/dashboard" element={<VendorDashboard />} />
      <Route path="admin/vendor-apps" element={<AdminVendorApps />} />
      {/* Vendor product CRUD */}
      <Route path="products/new" element={<ProductCreate />} />
      <Route path="products/:id/edit" element={<ProductEdit />} />
      <Route path="*" element={<div>Not found.</div>} />
    </Routes>
  );
}
