import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { db } from './sequelize.js';

export class WebhookEvent extends Model<
  InferAttributes<WebhookEvent>,
  InferCreationAttributes<WebhookEvent>
> {
  declare id: CreationOptional<number>;
  declare source: string;
  declare eventId: string;
  declare type: string;
  declare status: string;              // 'received' | 'processed' | 'skipped' | 'error'
  declare firstSeenAt: CreationOptional<Date>;
  declare processedAt: Date | null;
  declare payload: object | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();
if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — WebhookEvent model not initialized');
  }
} else {
  WebhookEvent.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'stripe' },
      eventId: { type: DataTypes.STRING(120), allowNull: false, field: 'event_id' },
      type: { type: DataTypes.STRING(180), allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'received' },
      firstSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'first_seen_at',
      },
      processedAt: { type: DataTypes.DATE, allowNull: true, field: 'processed_at' },
      payload: { type: DataTypes.JSONB, allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'webhook_events',
      modelName: 'WebhookEvent',
      indexes: [{ fields: ['type'] }],
    }
  );
}
