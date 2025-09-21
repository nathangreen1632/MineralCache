export type Vendor = {
  id: number;
  userId: number;
  displayName: string;
  slug: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  logoUrl?: string | null;
  country?: string | null;
  createdAt?: string;
};