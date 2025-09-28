// Server/src/models/order.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export type OrderStatus = 'pending_payment' | 'paid' | 'failed' | 'refunded';

export class Order extends Model<
  InferAttributes<Order>,
  InferCreationAttributes<Order>
> {
  declare id: CreationOptional<number>;
  declare buyerUserId: number;

  declare status: OrderStatus;

  // Stripe
  declare paymentIntentId: string | null;

  // Money snapshots
  declare subtotalCents: number;
  declare shippingCents: number;
  declare totalCents: number;

  // Commission snapshot (for platform reconciliation)
  declare commissionPct: number;     // e.g., 0.08
  declare commissionCents: number;   // e.g., 123

  // Per-vendor shipping snapshot: { [vendorId: string]: number }
  declare vendorShippingJson: object | null;

  // Timestamps
  declare paidAt: Date | null;
  declare failedAt: Date | null;
  declare refundedAt: Date | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — Order model not initialized');
  }
} else {
  Order.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      buyerUserId: { type: DataTypes.BIGINT, allowNull: false },

      status: {
        type: DataTypes.ENUM('pending_payment', 'paid', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending_payment',
      },

      paymentIntentId: { type: DataTypes.STRING(200), allowNull: true },

      subtotalCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      shippingCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
      totalCents:    { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },

      commissionPct:   { type: DataTypes.DECIMAL(6, 4), allowNull: false, defaultValue: 0.08 },
      commissionCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      vendorShippingJson: { type: DataTypes.JSONB, allowNull: true },

      paidAt: { type: DataTypes.DATE, allowNull: true },
      failedAt: { type: DataTypes.DATE, allowNull: true },
      refundedAt: { type: DataTypes.DATE, allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'orders',
      modelName: 'Order',
      indexes: [
        { fields: ['buyerUserId'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
        { unique: true, fields: ['paymentIntentId'] },
        { name: 'orders_buyer_created_idx', fields: ['buyerUserId', 'createdAt'] },
      ],
    }
  );
}
