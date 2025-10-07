import {
  DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class Category extends Model<
  InferAttributes<Category>,
  InferCreationAttributes<Category>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare slug: string;
  declare active: boolean;
  declare homeOrder: number;
  declare imageKey: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — Category model not initialized');
  }
} else {
  Category.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      homeOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
      imageKey: { type: DataTypes.STRING(255), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'categories',
      sequelize,
      indexes: [{ fields: ['active'] }, { fields: ['homeOrder'] }],
    }
  );
}
