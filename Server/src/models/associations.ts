// Server/src/models/associations.ts
import { Order } from './order.model.js';
import { OrderVendor } from './orderVendor.model.js';
import { OrderItem } from './orderItem.model.js';
import { Product } from './product.model.js';
import { ProductImage } from './productImage.model.js';

// NEW: Category models
import { Category } from './category.model.js';
import { ProductCategory } from './productCategory.model.js';

// Make the FK mapping explicit (name + field) to avoid underscored/camelCase drift
OrderVendor.belongsTo(Order, { as: 'order', foreignKey: { name: 'orderId', field: 'orderId' } });
Order.hasMany(OrderVendor, { as: 'vendorBreakdowns', foreignKey: { name: 'orderId', field: 'orderId' } });

Order.hasMany(OrderItem, { as: 'items', foreignKey: { name: 'orderId', field: 'orderId' } });
OrderItem.belongsTo(Order, { as: 'order', foreignKey: { name: 'orderId', field: 'orderId' } });

Product.hasMany(ProductImage, { as: 'images', foreignKey: { name: 'productId', field: 'productId' } });
ProductImage.belongsTo(Product, { foreignKey: { name: 'productId', field: 'productId' } });

// ✅ Product ↔ Category (many-to-many; enforced "one" today via unique index on product_categories.productId)
Product.belongsToMany(Category, { through: ProductCategory, foreignKey: { name: 'productId', field: 'productId' }, otherKey: { name: 'categoryId', field: 'categoryId' }, as: 'categories' });

Category.belongsToMany(Product, { through: ProductCategory, foreignKey: { name: 'categoryId', field: 'categoryId' }, otherKey: { name: 'productId', field: 'productId' }, as: 'products' });
