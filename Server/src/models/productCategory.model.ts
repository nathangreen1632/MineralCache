import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { db } from './sequelize.js';

export class ProductCategory extends Model<
  InferAttributes<ProductCategory>,
  InferCreationAttributes<ProductCategory>
> {
  declare productId: number;
  declare categoryId: number;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — ProductCategory model not initialized');
  }
} else {
  ProductCategory.init(
    {
      productId: { type: DataTypes.BIGINT, allowNull: false },
      categoryId: { type: DataTypes.BIGINT, allowNull: false },
    },
    {
      tableName: 'product_categories',
      sequelize,
      timestamps: false,
      indexes: [
        { unique: true, fields: ['productId', 'categoryId'] },
        // Enforce "single category per product" for now:
        { unique: true, fields: ['productId'], name: 'uniq_product_category_once' },
        { fields: ['categoryId'] },
      ],
    }
  );
}
