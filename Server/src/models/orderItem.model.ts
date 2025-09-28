// Server/src/models/orderItem.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class OrderItem extends Model<
  InferAttributes<OrderItem>,
  InferCreationAttributes<OrderItem>
> {
  declare id: CreationOptional<number>;
  declare orderId: number;
  declare productId: number;
  declare vendorId: number;

  declare title: string;
  declare unitPriceCents: number;
  declare quantity: number;
  declare lineTotalCents: number;

  // ✅ Commission snapshot (per-line)
  declare commissionPct: number;      // e.g. 0.08 for 8%
  declare commissionCents: number;    // allocated cents from order fee

  // ✅ NEW: Fulfillment tracking (per-line)
  declare shipCarrier: string | null;
  declare shipTracking: string | null;
  declare shippedAt: Date | null;
  declare deliveredAt: Date | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — OrderItem model not initialized');
  }
} else {
  OrderItem.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      orderId: { type: DataTypes.BIGINT, allowNull: false },
      productId: { type: DataTypes.BIGINT, allowNull: false },
      vendorId: { type: DataTypes.BIGINT, allowNull: false },

      title: { type: DataTypes.TEXT, allowNull: false },
      unitPriceCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
      lineTotalCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },

      // Commission snapshot
      commissionPct: { type: DataTypes.DECIMAL(6, 5), allowNull: false, defaultValue: 0 }, // 0.00000–9.99999
      commissionCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      // Fulfillment tracking (snake_case columns)
      shipCarrier: { type: DataTypes.STRING, allowNull: true, field: 'ship_carrier' },
      shipTracking: { type: DataTypes.STRING, allowNull: true, field: 'ship_tracking' },
      shippedAt: { type: DataTypes.DATE, allowNull: true, field: 'shipped_at' },
      deliveredAt: { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'order_items',
      modelName: 'OrderItem',
      indexes: [
        { fields: ['orderId'] },
        { fields: ['vendorId'] },
        { fields: ['productId'] },
      ],
    }
  );
}
