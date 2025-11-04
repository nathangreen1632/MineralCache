// Server/src/models/vendor.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class Vendor extends Model<
  InferAttributes<Vendor>,
  InferCreationAttributes<Vendor>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare displayName: string;
  declare slug: string;
  declare bio: string | null;
  declare logoUrl: string | null;
  declare country: string | null;
  declare approvalStatus: 'pending' | 'approved' | 'rejected';
  declare approvedBy: number | null;
  declare approvedAt: Date | null;
  declare rejectedReason: string | null;
  declare stripeAccountId: string | null;
  declare commissionOverridePct: string | null;
  declare commissionPct: string | null;
  declare minFeeOverrideCents: number | null;
  declare newVendorCompletedCount: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[db] DATABASE_URL not set — Vendor model not initialized');
  }
} else {
  Vendor.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      displayName: { type: DataTypes.STRING(120), allowNull: false },
      slug: { type: DataTypes.STRING(140), allowNull: false },
      bio: { type: DataTypes.TEXT, allowNull: true },
      logoUrl: { type: DataTypes.STRING(500), allowNull: true },
      country: { type: DataTypes.STRING(2), allowNull: true },
      approvalStatus: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      approvedBy: { type: DataTypes.BIGINT, allowNull: true },
      approvedAt: { type: DataTypes.DATE, allowNull: true },
      rejectedReason: { type: DataTypes.TEXT, allowNull: true },
      stripeAccountId: { type: DataTypes.STRING(120), allowNull: true },
      commissionOverridePct: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
      commissionPct: {
        type: DataTypes.VIRTUAL,
        get(this: Vendor) {
          const v = this.getDataValue('commissionOverridePct') as unknown as string | null;
          return v ?? null;
        },
      },
      minFeeOverrideCents: { type: DataTypes.INTEGER, allowNull: true },
      newVendorCompletedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'vendors',
      modelName: 'Vendor',
      indexes: [
        { unique: true, fields: ['slug'] },
        { unique: true, fields: ['displayName'] },
        { name: 'vendors_approval_status_idx', fields: ['approvalStatus'] },
      ],
    }
  );
}
