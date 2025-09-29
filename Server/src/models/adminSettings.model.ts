// Server/src/models/adminSettings.model.ts
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { db } from './sequelize.js';

export class AdminSettings extends Model<
  InferAttributes<AdminSettings>,
  InferCreationAttributes<AdminSettings>
> {
  declare id: CreationOptional<number>;
  declare commission_bps: number;            // basis points (800 = 8%)
  declare min_fee_cents: number;             // 75 = $0.75
  declare stripe_enabled: boolean;
  declare currency: string;                  // 'usd'

  declare ship_flat_cents: number;           // per-vendor flat
  declare ship_per_item_cents: number;       // per item
  declare ship_free_threshold_cents: number | null;
  declare ship_handling_cents: number | null;

  // NEW: outbound email + branding
  declare emailFrom: string | null;
  declare brandName: string | null;

  // NEW: simple sales tax settings
  declare tax_rate_bps: number;              // e.g., 825 = 8.25%
  declare tax_label: string | null;          // e.g., 'State sales tax'

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();
if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — AdminSettings model not initialized');
  }
} else {
  AdminSettings.init(
    {
      id: { type: DataTypes.SMALLINT, primaryKey: true, defaultValue: 1 },

      commission_bps: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 800 },
      min_fee_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 75 },
      stripe_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'usd' },

      ship_flat_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ship_per_item_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ship_free_threshold_cents: { type: DataTypes.INTEGER, allowNull: true },
      ship_handling_cents: { type: DataTypes.INTEGER, allowNull: true },

      // NEW fields (stored as snake_case columns)
      emailFrom: { type: DataTypes.STRING, allowNull: true, field: 'email_from' },
      brandName: { type: DataTypes.STRING, allowNull: true, field: 'brand_name' },

      // NEW: tax fields
      tax_rate_bps: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      tax_label: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'admin_settings',
      modelName: 'AdminSettings',
    }
  );
}
