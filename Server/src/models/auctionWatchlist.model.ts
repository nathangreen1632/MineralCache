import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class AuctionWatchlist extends Model<
  InferAttributes<AuctionWatchlist>,
  InferCreationAttributes<AuctionWatchlist>
> {
  declare id: CreationOptional<number>;
  declare auctionId: number;
  declare userId: number;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — AuctionWatchlist model not initialized');
  }
} else {
  AuctionWatchlist.init(
    {
      id:        { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      auctionId: { type: DataTypes.BIGINT, allowNull: false },
      userId:    { type: DataTypes.BIGINT, allowNull: false },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'auction_watchlist',
      modelName: 'AuctionWatchlist',
      indexes: [
        { name: 'aw_watch_auction_idx', fields: ['auctionId'] },
        { name: 'aw_watch_user_idx',    fields: ['userId'] },
        { unique: true, name: 'aw_watch_auction_user_uc', fields: ['auctionId', 'userId'] },
      ],
    }
  );
}
