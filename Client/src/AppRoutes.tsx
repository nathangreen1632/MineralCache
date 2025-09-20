// Client/src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import VendorApply from './pages/VendorApply';
import AdminVendorApps from './pages/admin/AdminVendorApps';

export default function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="vendor/apply" element={<VendorApply />} />
      <Route path="admin/vendor-apps" element={<AdminVendorApps />} />
      <Route path="*" element={<div>Not found.</div>} />
    </Routes>
  );
}
