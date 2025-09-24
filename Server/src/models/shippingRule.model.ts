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
  declare vendorId: number | null;            // null → global default
  declare label: string;                      // e.g., "Flat + per item"
  declare isActive: boolean;                  // only one active per scope is expected

  declare baseCents: number;                  // flat per vendor/order
  declare perItemCents: number;               // per item (quantity)
  declare freeThresholdCents: number | null;  // if subtotal ≥ threshold → free

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
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      baseCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      perItemCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
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
        { fields: ['isActive'] },
        { name: 'shipping_rules_vendor_active_idx', fields: ['vendorId', 'isActive'] },
      ],
    }
  );
}
