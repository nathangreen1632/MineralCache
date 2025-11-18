// Server/src/models/associations.ts
import { Order } from './order.model.js';
import { OrderVendor } from './orderVendor.model.js';
import { OrderItem } from './orderItem.model.js';
import { Product } from './product.model.js';
import { ProductImage } from './productImage.model.js';
import { Auction } from './auction.model.js';
import { Vendor } from './vendor.model.js';
import { User } from './user.model.js';
import { UserAgreement } from './userAgreement.model.js';
export { PasswordReset } from './passwordReset.model.js';

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

// 👇 NEW: Auction ↔ Product (for listing auctions with product details/images)
Auction.belongsTo(Product, { as: 'product', foreignKey: { name: 'productId', field: 'productId' } });
Product.hasMany(Auction, { as: 'auctions', foreignKey: { name: 'productId', field: 'productId' } });

// 👇 NEW: Auction ↔ Vendor (to expose vendor.slug → vendorSlug in API)
Auction.belongsTo(Vendor, { as: 'vendor', foreignKey: { name: 'vendorId', field: 'vendorId' } });
Vendor.hasMany(Auction, { as: 'auctions', foreignKey: { name: 'vendorId', field: 'vendorId' } });

// ✅ Product ↔ Category (many-to-many; enforced "one" today via unique index on product_categories.productId)
Product.belongsToMany(Category, { through: ProductCategory, foreignKey: { name: 'productId', field: 'productId' }, otherKey: { name: 'categoryId', field: 'categoryId' }, as: 'categories' });
Category.belongsToMany(Product, { through: ProductCategory, foreignKey: { name: 'categoryId', field: 'categoryId' }, otherKey: { name: 'productId', field: 'productId' }, as: 'products' });

Product.belongsTo(Vendor, { as: 'vendor', foreignKey: { name: 'vendorId', field: 'vendorId' } });
Vendor.hasMany(Product, { as: 'products', foreignKey: { name: 'vendorId', field: 'vendorId' } });

UserAgreement.belongsTo(User, { as: 'user', foreignKey: { name: 'userId', field: 'userId' } });
User.hasMany(UserAgreement, { as: 'agreements', foreignKey: { name: 'userId', field: 'userId' } });

Vendor.belongsTo(User, { as: 'owner', foreignKey: { name: 'userId', field: 'userId' } });
User.hasOne(Vendor, { as: 'vendor', foreignKey: { name: 'userId', field: 'userId' } });
