// Server/src/models/product.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export class Product extends Model<
  InferAttributes<Product>,
  InferCreationAttributes<Product>
> {
  declare id: CreationOptional<number>;
  declare vendorId: number;

  declare title: string;
  declare description: string | null;

  // Mineral-specific attributes
  declare species: string;
  declare locality: string | null;
  declare size: string | null;          // e.g., "35 x 22 x 18 mm"
  declare weight: string | null;        // e.g., "24.3 g"
  declare fluorescence: string | null;
  declare condition: string | null;
  declare provenance: string | null;

  declare synthetic: boolean;
  declare onSale: boolean;

  declare priceCents: number;
  declare compareAtCents: number | null;

  // Soft delete
  declare archivedAt: Date | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelize = db.instance();

if (!sequelize) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL not set — Product model not initialized');
  }
} else {
  Product.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      vendorId: { type: DataTypes.BIGINT, allowNull: false },

      title: { type: DataTypes.STRING(140), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },

      species: { type: DataTypes.STRING(140), allowNull: false },
      locality: { type: DataTypes.STRING(200), allowNull: true },
      size: { type: DataTypes.STRING(120), allowNull: true },
      weight: { type: DataTypes.STRING(120), allowNull: true },
      fluorescence: { type: DataTypes.STRING(120), allowNull: true },
      condition: { type: DataTypes.STRING(200), allowNull: true },
      provenance: { type: DataTypes.STRING(500), allowNull: true },

      synthetic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      onSale: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      priceCents: { type: DataTypes.INTEGER, allowNull: false },
      compareAtCents: { type: DataTypes.INTEGER, allowNull: true },

      archivedAt: { type: DataTypes.DATE, allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'products',
      modelName: 'Product',
      indexes: [
        { fields: ['vendorId'] },
        { fields: ['species'] },
        { fields: ['synthetic'] },
        { fields: ['onSale'] },
        { fields: ['priceCents'] },
        { fields: ['createdAt'] },
        // Helpful combined indexes for common filters/sorts
        { name: 'products_vendor_onSale_idx', fields: ['vendorId', 'onSale'] },
        { name: 'products_vendor_created_idx', fields: ['vendorId', 'createdAt'] },
      ],
    }
  );
}
