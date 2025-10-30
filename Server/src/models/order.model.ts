import { DataTypes, Model, type CreationOptional } from 'sequelize';
import { db } from './sequelize.js';

export type OrderStatus =
  | 'pending'
  | 'pending_payment'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'cancelled';

export type OrderAttributes = {
  id: CreationOptional<number>;
  buyerUserId: number;
  status: OrderStatus;
  paymentIntentId: string | null;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  commissionPct: number;
  commissionCents: number;
  vendorShippingJson: object | null;
  paidAt: Date | null;
  failedAt: Date | null;
  refundedAt: Date | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
};

export type OrderCreationAttributes = Partial<OrderAttributes> &
  Pick<OrderAttributes, 'buyerUserId' | 'subtotalCents' | 'totalCents'>;

export class Order
  extends Model<OrderAttributes, OrderCreationAttributes>
  implements OrderAttributes
{
  declare id: CreationOptional<number>;
  declare buyerUserId: number;
  declare status: OrderStatus;
  declare paymentIntentId: string | null;
  declare subtotalCents: number;
  declare shippingCents: number;
  declare taxCents: number;
  declare totalCents: number;
  declare commissionPct: number;
  declare commissionCents: number;
  declare vendorShippingJson: object | null;
  declare paidAt: Date | null;
  declare failedAt: Date | null;
  declare refundedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[db] DATABASE_URL not set — Order model not initialized');
  }
} else {
  Order.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      // 👇 maps buyerUserId (JS) -> userId (DB)
      buyerUserId: { type: DataTypes.BIGINT, allowNull: false, field: 'userId' },

      status: {
        type: DataTypes.ENUM(
          'pending',
          'pending_payment',
          'paid',
          'partially_refunded',
          'refunded',
          'failed',
          'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending_payment',
      },

      paymentIntentId: { type: DataTypes.STRING(200), allowNull: true },
      subtotalCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      shippingCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
      taxCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'tax_cents' },
      totalCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      commissionPct: { type: DataTypes.DECIMAL(6, 4), allowNull: false, defaultValue: 0.08 },
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
        { fields: ['userId'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
        { unique: true, fields: ['paymentIntentId'] },
        { name: 'orders_buyer_created_idx', fields: ['userId', 'createdAt'] },
      ],
    }
  );
}
