// e.g., Server/src/models/associations.ts (or wherever you link models)
import { Order } from './order.model.js';
import { OrderVendor } from './orderVendor.model.js';
import {Product} from "./product.model.js";
import {ProductImage} from "./productImage.model.js";

OrderVendor.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Product.hasMany(ProductImage, { as: 'images', foreignKey: 'productId' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });
