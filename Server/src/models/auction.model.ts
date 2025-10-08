import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export type AuctionStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
export type IncrementTier = { upToCents: number | null; incrementCents: number };

export class Auction extends Model<
  InferAttributes<Auction>,
  InferCreationAttributes<Auction>
> {
  declare id: CreationOptional<number>;
  declare productId: number;
  declare vendorId: number;

  declare title: string;
  declare status: AuctionStatus;

  declare startAt: Date | null;
  declare endAt: Date | null;

  // DB column names (NOT the API names)
  declare startPriceCents: number;
  declare reservePriceCents: number | null;
  declare buyNowPriceCents: number | null;

  declare incrementLadderJson: IncrementTier[] | null;

  declare highBidCents: number | null;
  declare highBidUserId: number | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — Auction model not initialized');
  }
} else {
  Auction.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      productId: { type: DataTypes.BIGINT, allowNull: false },
      vendorId:  { type: DataTypes.BIGINT, allowNull: false },

      title:  { type: DataTypes.STRING(200), allowNull: false },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'live', 'ended', 'canceled'),
        allowNull: false,
        defaultValue: 'draft',
      },

      startAt: { type: DataTypes.DATE, allowNull: true },
      endAt:   { type: DataTypes.DATE, allowNull: true },

      // ← map model attrs to existing DB columns
      startPriceCents:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },             // uses "startPriceCents"
      reservePriceCents: { type: DataTypes.INTEGER, allowNull: true,  field: 'reserveCents' },      // bridge to existing column
      buyNowPriceCents:  { type: DataTypes.INTEGER, allowNull: true,  field: 'buyNowCents' },       // bridge to existing column

      incrementLadderJson:{ type: DataTypes.JSONB, allowNull: true },

      highBidCents:  { type: DataTypes.INTEGER, allowNull: true },
      highBidUserId: { type: DataTypes.BIGINT,  allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'auctions',
      modelName: 'Auction',
      indexes: [
        { fields: ['productId'] },
        { fields: ['vendorId'] },
        { fields: ['status', 'endAt'] },
        { name: 'auctions_vendor_status_end_idx', fields: ['vendorId', 'status', 'endAt'] },
      ],
    }
  );
}
