// Server/src/models/productImage.model.ts
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { db } from './sequelize.js';

export class ProductImage extends Model<
  InferAttributes<ProductImage>,
  InferCreationAttributes<ProductImage>
> {
  declare id: CreationOptional<number>;
  declare productId: number;

  declare fileName: string;
  declare mimeType: string;

  // Original
  declare origPath: string;
  declare origBytes: number;
  declare origWidth: number | null;
  declare origHeight: number | null;

  // 320px derivative
  declare v320Path: string | null;
  declare v320Bytes: number | null;
  declare v320Width: number | null;
  declare v320Height: number | null;

  // 800px derivative
  declare v800Path: string | null;
  declare v800Bytes: number | null;
  declare v800Width: number | null;
  declare v800Height: number | null;

  // 1600px derivative
  declare v1600Path: string | null;
  declare v1600Bytes: number | null;
  declare v1600Width: number | null;
  declare v1600Height: number | null;

  // Display order within a listing
  declare sortOrder: number;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — ProductImage model not initialized');
  }
} else {
  ProductImage.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      productId: { type: DataTypes.BIGINT, allowNull: false },

      fileName: { type: DataTypes.STRING(260), allowNull: false },
      mimeType: { type: DataTypes.STRING(100), allowNull: false },

      origPath: { type: DataTypes.STRING(500), allowNull: false },
      origBytes: { type: DataTypes.INTEGER, allowNull: false },
      origWidth: { type: DataTypes.INTEGER, allowNull: true },
      origHeight: { type: DataTypes.INTEGER, allowNull: true },

      v320Path: { type: DataTypes.STRING(500), allowNull: true },
      v320Bytes: { type: DataTypes.INTEGER, allowNull: true },
      v320Width: { type: DataTypes.INTEGER, allowNull: true },
      v320Height: { type: DataTypes.INTEGER, allowNull: true },

      v800Path: { type: DataTypes.STRING(500), allowNull: true },
      v800Bytes: { type: DataTypes.INTEGER, allowNull: true },
      v800Width: { type: DataTypes.INTEGER, allowNull: true },
      v800Height: { type: DataTypes.INTEGER, allowNull: true },

      v1600Path: { type: DataTypes.STRING(500), allowNull: true },
      v1600Bytes: { type: DataTypes.INTEGER, allowNull: true },
      v1600Width: { type: DataTypes.INTEGER, allowNull: true },
      v1600Height: { type: DataTypes.INTEGER, allowNull: true },

      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'product_images',
      modelName: 'ProductImage',
      indexes: [
        { fields: ['productId'] },
        { name: 'product_images_product_sort_idx', fields: ['productId', 'sortOrder'] },
        { name: 'product_images_product_created_idx', fields: ['productId', 'createdAt'] },
      ],
    }
  );
}
