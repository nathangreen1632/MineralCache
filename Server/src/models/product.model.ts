// Server/src/models/product.model.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { db } from './sequelize.js';

export type FluorescenceMode = 'none' | 'SW' | 'LW' | 'both';
export type ConditionKind = 'pristine' | 'minor_damage' | 'repaired' | 'restored';

export type ProvenanceEntry = {
  owner: string;
  yearStart?: number;
  yearEnd?: number;
  note?: string;
};

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

  // Dimensions (cm) + note
  declare lengthCm: number | null;
  declare widthCm: number | null;
  declare heightCm: number | null;
  declare sizeNote: string | null;

  // Weight
  declare weightG: number | null;
  declare weightCt: number | null;

  // Fluorescence (structured)
  declare fluorescenceMode: FluorescenceMode;
  declare fluorescenceColorNote: string | null;
  declare fluorescenceWavelengthNm: number[] | null; // e.g., [254, 365]

  // Condition
  declare condition: ConditionKind | null;
  declare conditionNote: string | null;

  // Provenance
  declare provenanceNote: string | null;
  declare provenanceTrail: ProvenanceEntry[] | null;

  declare synthetic: boolean;

  // Pricing
  declare priceCents: number;
  declare salePriceCents: number | null;
  declare saleStartAt: Date | null;
  declare saleEndAt: Date | null;

  // Soft delete
  declare archivedAt: Date | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Optional convenience helper
  getEffectivePriceCents(now: Date = new Date()): number {
    const price = Number((this as any).getDataValue('priceCents') ?? 0);
    const sale = (this as any).getDataValue('salePriceCents') as number | null;
    const start = (this as any).getDataValue('saleStartAt') as Date | null;
    const end = (this as any).getDataValue('saleEndAt') as Date | null;
    if (sale == null) return price;
    const n = now.getTime();
    const within =
      (!start || start.getTime() <= n) &&
      (!end || n <= end.getTime());
    return within ? Number(sale) : price;
  }
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

      // Dimensions (cm)
      lengthCm: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      widthCm: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      heightCm: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      sizeNote: { type: DataTypes.TEXT, allowNull: true },

      // Weight
      weightG: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      weightCt: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        validate: { min: 0 },
      },

      // Fluorescence (structured)
      fluorescenceMode: {
        type: DataTypes.ENUM('none', 'SW', 'LW', 'both'),
        allowNull: false,
        defaultValue: 'none',
      },
      fluorescenceColorNote: { type: DataTypes.TEXT, allowNull: true },
      fluorescenceWavelengthNm: { type: DataTypes.JSONB, allowNull: true }, // number[]

      // Condition
      condition: {
        type: DataTypes.ENUM('pristine', 'minor_damage', 'repaired', 'restored'),
        allowNull: true,
      },
      conditionNote: { type: DataTypes.TEXT, allowNull: true },

      // Provenance
      provenanceNote: { type: DataTypes.TEXT, allowNull: true },
      provenanceTrail: { type: DataTypes.JSONB, allowNull: true }, // ProvenanceEntry[]

      synthetic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // Pricing (scheduled sale model)
      priceCents: { type: DataTypes.INTEGER, allowNull: false },
      salePriceCents: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
      saleStartAt: { type: DataTypes.DATE, allowNull: true },
      saleEndAt: { type: DataTypes.DATE, allowNull: true },

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

        // New filter/sort helpers
        { fields: ['condition'] },
        { fields: ['fluorescenceMode'] },
        { fields: ['priceCents'] },
        { fields: ['salePriceCents'] },
        { fields: ['lengthCm'] },
        { fields: ['widthCm'] },
        { fields: ['heightCm'] },
        { fields: ['createdAt'] },

        // Helpful combined indexes for common filters/sorts
        { name: 'products_vendor_created_idx', fields: ['vendorId', 'createdAt'] },
      ],
    }
  );
}
