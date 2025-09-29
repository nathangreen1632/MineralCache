import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class OrderVendor extends Model<
  InferAttributes<OrderVendor>,
  InferCreationAttributes<OrderVendor>
> {
  declare id: CreationOptional<number>;
  declare orderId: number;
  declare vendorId: number;

  declare vendorGrossCents: number; // items + vendor shipping
  declare vendorFeeCents: number;   // proportion of platform fee (sum of item commissions for this vendor)
  declare vendorNetCents: number;   // gross - fee

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();
if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — OrderVendor model not initialized');
  }
} else {
  OrderVendor.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      orderId: { type: DataTypes.BIGINT, allowNull: false, field: 'order_id' },
      vendorId: { type: DataTypes.BIGINT, allowNull: false, field: 'vendor_id' },

      vendorGrossCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'vendor_gross_cents' },
      vendorFeeCents:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'vendor_fee_cents' },
      vendorNetCents:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'vendor_net_cents' },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      sequelize,
      tableName: 'order_vendor',
      modelName: 'OrderVendor',
      indexes: [
        { fields: ['order_id'] },
        { fields: ['vendor_id'] },
        { unique: true, fields: ['order_id', 'vendor_id'], name: 'order_vendor_order_vendor_uc' },
      ],
    }
  );
}
