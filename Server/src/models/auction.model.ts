import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

export type IncrementTier = { upToCents: number | null; incrementCents: number };

export class Auction extends Model<InferAttributes<Auction>, InferCreationAttributes<Auction>> {
  declare id: CreationOptional<number>;
  declare productId: number;
  declare vendorId: number;
  declare title: string;
  declare status: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
  declare startAt: Date | null;
  declare endAt: Date | null;
  declare startingBidCents: number;
  declare reserveCents: number | null;
  declare incrementLadderJson: IncrementTier[] | null;
  declare highBidCents: number | null;
  declare highBidUserId: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initAuction(sequelize: Sequelize) {
  Auction.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      vendorId: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'live', 'ended', 'canceled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      startAt: { type: DataTypes.DATE, allowNull: true },
      endAt: { type: DataTypes.DATE, allowNull: true },
      startingBidCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      reserveCents: { type: DataTypes.INTEGER, allowNull: true },
      incrementLadderJson: { type: DataTypes.JSONB, allowNull: true },
      highBidCents: { type: DataTypes.INTEGER, allowNull: true },
      highBidUserId: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'auctions',
      indexes: [
        { fields: ['vendorId', 'status', 'endAt'] },
        { fields: ['productId'] },
        { fields: ['status', 'endAt'] },
      ],
    }
  );
}
