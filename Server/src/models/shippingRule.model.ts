// Server/src/models/shippingRule.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class ShippingRule extends Model<
  InferAttributes<ShippingRule>,
  InferCreationAttributes<ShippingRule>
> {
  declare id: CreationOptional<number>;
  declare vendorId: number | null;            // null → global scope
  declare label: string;                      // e.g., "Flat + per item"

  // NOTE: use attribute "active", but map to existing DB column "isActive"
  declare active: boolean;                    // single active rule per scope (recommended)
  declare priority: number;                   // lower = chosen first
  declare isDefaultGlobal: boolean;           // only one global default at a time

  declare baseCents: number;                  // flat per vendor/order
  declare perItemCents: number;               // per item (quantity)
  declare perWeightCents: number;             // per weight-unit (optional; 0 = off)
  declare minCents: number | null;            // clamp floor (optional)
  declare maxCents: number | null;            // clamp ceiling (optional)
  declare freeThresholdCents: number | null;  // if subtotal ≥ threshold → free (legacy/optional)

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — ShippingRule model not initialized');
  }
} else {
  ShippingRule.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      vendorId: { type: DataTypes.BIGINT, allowNull: true },
      label: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'Shipping' },

      // Map attribute "active" -> DB column "isActive" to preserve existing data
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'isActive' },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
      isDefaultGlobal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      baseCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      perItemCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      perWeightCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      minCents: { type: DataTypes.INTEGER, allowNull: true },
      maxCents: { type: DataTypes.INTEGER, allowNull: true },
      freeThresholdCents: { type: DataTypes.INTEGER, allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'shipping_rules',
      modelName: 'ShippingRule',
      indexes: [
        { fields: ['vendorId'] },
        { fields: ['active'] },
        { name: 'shipping_rules_vendor_active_idx', fields: ['vendorId', 'active', 'priority'] },
        { fields: ['isDefaultGlobal'] },
        { fields: ['priority'] },
        // Postgres-only partial index (safe to keep; ignored by other dialects)
        {
          name: 'shipping_rules_global_active_idx',
          fields: ['active', 'isDefaultGlobal', 'priority', 'id'],
          where: { vendorId: null },
        },
      ],
    }
  );
}
