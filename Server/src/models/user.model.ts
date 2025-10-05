// Server/src/models/user.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare passwordHash: string;
  declare role: 'buyer' | 'vendor' | 'admin';
  declare dobVerified18: boolean;
  declare vendorId: number | null;                 // ✅ ADD
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — User model not initialized');
  }
} else {
  User.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      role: {
        type: DataTypes.ENUM('buyer', 'vendor', 'admin'),
        allowNull: false,
        defaultValue: 'buyer',
      },
      dobVerified18: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      vendorId: { type: DataTypes.BIGINT, allowNull: true }, // ✅ ADD
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'users',
      modelName: 'User',
    }
  );
}
