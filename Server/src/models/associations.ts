// e.g., Server/src/models/associations.ts (or wherever you link models)
import { Order } from './order.model.js';
import { OrderVendor } from './orderVendor.model.js';

OrderVendor.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
