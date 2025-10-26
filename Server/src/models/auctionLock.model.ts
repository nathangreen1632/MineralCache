import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export type AuctionLockStatus = 'active' | 'paid' | 'released';

export class AuctionLock extends Model<
  InferAttributes<AuctionLock>,
  InferCreationAttributes<AuctionLock>
> {
  declare id: CreationOptional<number>;
  declare productId: number;
  declare userId: number;
  declare auctionId: number;
  declare priceCents: number;
  declare expiresAt: Date;
  declare status: AuctionLockStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — AuctionLock model not initialized');
  }
} else {
  AuctionLock.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      productId: { type: DataTypes.BIGINT, allowNull: false },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      auctionId: { type: DataTypes.BIGINT, allowNull: false },
      priceCents: { type: DataTypes.BIGINT, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.ENUM('active', 'paid', 'released'),
        allowNull: false,
        defaultValue: 'active',
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'auction_locks',
      modelName: 'AuctionLock',
      indexes: [
        { fields: ['productId'] },
        { fields: ['userId'] },
        { fields: ['auctionId'] },
        { fields: ['status'] },
        { fields: ['productId', 'status'] },
      ],
    }
  );
}
