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

  declare active: boolean;                    // maps → isActive
  declare priority: number;
  declare isDefaultGlobal: boolean;           // maps → is_default_global

  declare baseCents: number;
  declare perItemCents: number;
  declare perWeightCents: number;
  declare minCents: number | null;
  declare maxCents: number | null;
  declare freeThresholdCents: number | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[db] DATABASE_URL not set — ShippingRule model not initialized');
  }
} else {
  ShippingRule.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      vendorId: { type: DataTypes.BIGINT, allowNull: true },
      label: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'Shipping' },

      // ✅ field mapping preserved
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'isActive' },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },

      // ✅ IMPORTANT: map camelCase → actual DB column
      isDefaultGlobal: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default_global',
      },

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
        {
          name: 'shipping_rules_global_active_idx',
          fields: ['active', 'isDefaultGlobal', 'priority', 'id'],
          where: { vendorId: null },
        },
      ],
    }
  );
}
