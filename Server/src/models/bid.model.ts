import { DataTypes, Model, Sequelize } from 'sequelize';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Bid extends Model<InferAttributes<Bid>, InferCreationAttributes<Bid>> {
  declare id: CreationOptional<number>;
  declare auctionId: number;
  declare userId: number;
  declare amountCents: number;
  declare maxProxyCents: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initBid(sequelize: Sequelize) {
  Bid.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      auctionId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      amountCents: { type: DataTypes.INTEGER, allowNull: false },
      maxProxyCents: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, tableName: 'bids', indexes: [{ fields: ['auctionId', 'createdAt'] }] }
  );
}
