import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { db } from './sequelize.js';

const sequelize = db.instance();
if (!sequelize) throw new Error('Sequelize not configured');

export class UserAgreement extends Model<
  InferAttributes<UserAgreement>,
  InferCreationAttributes<UserAgreement>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare documentType: string;
  declare version: string;
  declare acceptedAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

UserAgreement.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT, allowNull: false, field: 'userId' },
    documentType: { type: DataTypes.STRING(64), allowNull: false, field: 'documentType' },
    version: { type: DataTypes.STRING(32), allowNull: false, field: 'version' },
    acceptedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'acceptedAt' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'createdAt' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updatedAt' },
  },
  {
    sequelize,
    modelName: 'UserAgreement',
    tableName: 'user_agreements',
    timestamps: true,
  }
);
