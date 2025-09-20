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
  declare stripeAccountId: string | null;
  declare commissionOverridePct: string | null; // DECIMAL as string
  declare minFeeOverrideCents: number | null;
  declare newVendorCompletedCount: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
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
      stripeAccountId: { type: DataTypes.STRING(120), allowNull: true },
      commissionOverridePct: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
      minFeeOverrideCents: { type: DataTypes.INTEGER, allowNull: true },
      newVendorCompletedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'vendors',
      modelName: 'Vendor',
      indexes: [{ unique: true, fields: ['slug'] }, { unique: true, fields: ['displayName'] }],
    }
  );
}
