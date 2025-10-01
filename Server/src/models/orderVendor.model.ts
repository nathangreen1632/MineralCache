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

  declare vendorGrossCents: number;
  declare vendorFeeCents: number;
  declare vendorNetCents: number;

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

      // 👇 map to the ACTUAL column names in your DB (camelCase per your ERD)
      orderId:           { type: DataTypes.BIGINT, allowNull: false, field: 'orderId' },
      vendorId:          { type: DataTypes.BIGINT, allowNull: false, field: 'vendorId' },
      vendorGrossCents:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'vendorGrossCents' },
      vendorFeeCents:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'vendorFeeCents' },
      vendorNetCents:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'vendorNetCents' },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'createdAt' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updatedAt' },
    },
    {
      sequelize,
      tableName: 'order_vendor',   // keep your existing table name
      modelName: 'OrderVendor',
      paranoid: false,
      underscored: false,          // IMPORTANT: you’re not using snake_case columns
      indexes: [
        { fields: ['orderId'] },
        { fields: ['vendorId'] },
        { unique: true, fields: ['orderId', 'vendorId'], name: 'order_vendor_order_vendor_uc' },
      ],
    }
  );
}
