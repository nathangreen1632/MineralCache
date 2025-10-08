import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class Bid extends Model<
  InferAttributes<Bid>,
  InferCreationAttributes<Bid>
> {
  declare id: CreationOptional<number>;
  declare auctionId: number;
  declare userId: number;

  declare amountCents: number;
  declare maxProxyCents: number | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — Bid model not initialized');
  }
} else {
  Bid.init(
    {
      id:        { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      auctionId: { type: DataTypes.BIGINT, allowNull: false },
      userId:    { type: DataTypes.BIGINT, allowNull: false },

      amountCents:   { type: DataTypes.INTEGER, allowNull: false },
      maxProxyCents: { type: DataTypes.INTEGER, allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'bids',
      modelName: 'Bid',
      indexes: [
        { fields: ['auctionId'] },
        { fields: ['userId'] },
        { fields: ['auctionId', 'createdAt'] },
      ],
    }
  );
}
