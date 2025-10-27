// Server/src/models/shippingRuleTier.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class ShippingRuleTier extends Model<
  InferAttributes<ShippingRuleTier>,
  InferCreationAttributes<ShippingRuleTier>
> {
  declare id: CreationOptional<number>;
  declare shippingRuleId: number;
  declare kind: 'price' | 'weight';
  declare minValue: number;
  declare maxValue: number | null;
  declare amountCents: number;
  declare priority: number;
  declare active: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — ShippingRuleTier model not initialized');
  }
} else {
  ShippingRuleTier.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      shippingRuleId: { type: DataTypes.BIGINT, allowNull: false, field: 'shipping_rule_id' },
      kind: { type: DataTypes.ENUM('price', 'weight'), allowNull: false },
      minValue: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'min_value' },
      maxValue: { type: DataTypes.INTEGER, allowNull: true, field: 'max_value' },
      amountCents: { type: DataTypes.INTEGER, allowNull: false, field: 'amount_cents' },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      sequelize,
      tableName: 'shipping_rule_tiers',
      modelName: 'ShippingRuleTier',
      indexes: [
        { fields: ['shipping_rule_id', 'kind', 'priority'], name: 'idx_shipping_rule_tiers_rule_kind_priority' },
        { fields: ['shipping_rule_id', 'active'], name: 'idx_shipping_rule_tiers_rule_active' },
      ],
    }
  );
}
