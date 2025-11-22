import { Op } from 'sequelize';
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';
import { Product } from '../models/product.model.js';
import { AuctionLock } from '../models/auctionLock.model.js';
import { User } from '../models/user.model.js';
import { retrievePaymentIntent } from '../services/stripe.service.js';
import { materializeOrderVendorMoney } from '../services/payouts.service.js';
import { sendOrderEmail } from '../services/email.service.js';
import { log } from '../services/log.service.js';

type PendingRunResult = {
  checked: number;
  markedPaid: number;
  markedFailed: number;
  skipped: number;
};

export async function processPendingPaymentOrders(): Promise<PendingRunResult> {
  const sequelize = Order.sequelize;
  if (!sequelize) throw new Error('Sequelize not initialized');

  const now = new Date();
  const staleSince = new Date(now.getTime() - 10 * 60 * 1000);

  const orders = await Order.findAll({
    where: {
      status: 'pending_payment',
      createdAt: { [Op.lte]: staleSince },
      paymentIntentId: { [Op.ne]: null },
    },
    order: [['id', 'ASC']],
  });

  const result: PendingRunResult = {
    checked: orders.length,
    markedPaid: 0,
    markedFailed: 0,
    skipped: 0,
  };

  for (const row of orders) {
    const intentId = String((row as any).paymentIntentId || '');
    if (!intentId) {
      result.skipped += 1;
      continue;
    }

    let pi: any;
    try {
      pi = await retrievePaymentIntent(intentId);
    } catch (err: any) {
      log.warn('pending_payments.intent.retrieve_failed', {
        orderId: Number(row.id),
        intentId,
        error: String(err?.message || err),
      });
      result.skipped += 1;
      continue;
    }

    const piStatus = String(pi?.status || '');

    if (piStatus === 'succeeded') {
      let paidOrderId: number | null = null;
      let paidOrderNumber: string | null = null;
      let buyerUserId: number | null = null;

      await sequelize.transaction(async (t) => {
        const order = await Order.findOne({
          where: { id: row.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!order) return;
        if ((order as any).status !== 'pending_payment') return;

        (order as any).status = 'paid';
        (order as any).paidAt = new Date();
        await order.save({ transaction: t });

        const buyerId = Number(
          (order as any).buyerUserId ?? (order as any)?.get?.('buyerUserId')
        );

        const items = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
        const productIds = items.map((i) => Number(i.productId)).filter(Number.isFinite);
        if (productIds.length > 0) {
          const nowArch = new Date();
          await Product.update(
            { archivedAt: nowArch },
            { where: { id: productIds }, transaction: t }
          );
          if (buyerId) {
            await AuctionLock.update(
              { status: 'paid' },
              {
                where: {
                  productId: { [Op.in]: productIds },
                  userId: buyerId,
                  status: 'active',
                },
                transaction: t,
              }
            );
          }
        }

        paidOrderId = Number(order.id);
        const rawOrderNumber =
          (order as any)?.orderNumber ??
          (typeof (order as any)?.get === 'function'
            ? (order as any).get('orderNumber')
            : undefined) ??
          (typeof (order as any)?.get === 'function'
            ? (order as any).get('order_number')
            : undefined) ??
          null;

        paidOrderNumber =
          typeof rawOrderNumber === 'string' && rawOrderNumber.length > 0
            ? rawOrderNumber
            : null;

        buyerUserId = Number(
          (order as any).buyerUserId ?? (order as any)?.get?.('buyerUserId')
        );
      });

      if (paidOrderId) {
        try {
          await materializeOrderVendorMoney(paidOrderId);
        } catch (err: any) {
          log.warn('pending_payments.payouts.materialize_failed', {
            orderId: paidOrderId,
            error: String(err?.message || err),
          });
        }
      }

      if (paidOrderId && buyerUserId) {
        try {
          const buyer = await User.findByPk(buyerUserId);
          if (buyer?.email) {
            const items = await OrderItem.findAll({ where: { orderId: paidOrderId } });
            const itemsBrief = items
              .map((i) => {
                const qty = i.quantity;
                return '• ' + i.title + ' ×' + qty;
              })
              .join('<br/>');

            const ord = await Order.findByPk(paidOrderId, {
              attributes: ['subtotalCents', 'shippingCents', 'taxCents', 'totalCents'],
            });

            await sendOrderEmail('order_paid', {
              orderId: paidOrderId,
              orderNumber: paidOrderNumber,
              buyer: { email: buyer.email, name: (buyer as any)?.fullName ?? null },
              itemsBrief,
              subtotalCents: Number((ord as any)?.subtotalCents ?? 0),
              shippingCents: Number((ord as any)?.shippingCents ?? 0),
              taxCents: Number((ord as any)?.taxCents ?? 0),
              totalCents: Number((ord as any)?.totalCents ?? 0),
            });
          }
        } catch (err: any) {
          log.warn('pending_payments.email.order_paid_failed', {
            orderId: paidOrderId,
            error: String(err?.message || err),
          });
        }
      }

      result.markedPaid += 1;
      log.info('pending_payments.order_marked_paid', {
        orderId: Number(row.id),
        intentId,
        stripeStatus: piStatus,
      });
    } else if (piStatus === 'canceled') {
      await Order.update(
        { status: 'failed', failedAt: new Date() },
        { where: { id: row.id, status: 'pending_payment' } }
      );
      result.markedFailed += 1;
      log.info('pending_payments.order_marked_failed', {
        orderId: Number(row.id),
        intentId,
        stripeStatus: piStatus,
      });
    } else {
      result.skipped += 1;
      log.info('pending_payments.order_skipped', {
        orderId: Number(row.id),
        intentId,
        stripeStatus: piStatus,
      });
    }
  }

  if (orders.length > 0) {
    log.info('pending_payments.run_summary', result);
  }

  return result;
}

export function initializePendingPaymentsScheduler() {
  let lastRunKey = '';
  setInterval(async () => {
    const chicagoNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
    );
    const yyyy = chicagoNow.getFullYear();
    const mm = String(chicagoNow.getMonth() + 1).padStart(2, '0');
    const dd = String(chicagoNow.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    const h = chicagoNow.getHours();
    const m = chicagoNow.getMinutes();
    const inWindow = h === 21 && m < 6;
    if (inWindow && key !== lastRunKey) {
      try {
        await processPendingPaymentOrders();
      } catch (err: any) {
        log.error('pending_payments.run_failed', {
          error: String(err?.message || err),
        });
      }
      lastRunKey = key;
    }
  }, 60 * 1000);
}
