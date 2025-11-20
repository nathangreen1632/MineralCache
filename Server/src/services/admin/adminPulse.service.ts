// Server/src/services/admin/adminPulse.service.ts
import { Op } from 'sequelize';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { OrderVendor } from '../../models/orderVendor.model.js';
import { Auction } from '../../models/auction.model.js';
import { User } from '../../models/user.model.js';

export type PulsePoint = {
  date: string;
  value: number;
};

export type AdminPulse = {
  ordersToday: number;
  ordersYesterday: number;
  gmvTodayCents: number;
  gmvYesterdayCents: number;
  activeAuctions: number;
  auctionsEndingSoon: number;
  newUsersToday: number;
  newUsersYesterday: number;
  ordersSeries: PulsePoint[];
  gmvSeries: PulsePoint[];
  newUsersSeries: PulsePoint[];
  lateShipments: number;
  payoutsReadyCents: number;
  paymentIncidents: number;
  emailIncidents: number;
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

async function dailySeries(
  days: number,
  getValue: (start: Date, end: Date) => Promise<number>
): Promise<PulsePoint[]> {
  const now = new Date();
  const out: PulsePoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const start = startOfDay(d);
    const end = endOfDay(d);
    const value = await getValue(start, end);
    out.push({
      date: start.toISOString().slice(0, 10),
      value: Number.isFinite(value) ? value : 0,
    });
  }
  return out;
}

export async function getAdminPulseSvc(): Promise<AdminPulse> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd = endOfDay(yesterday);

  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const shipCutoffDays = 3;
  const shipCutoff = new Date(now.getTime() - shipCutoffDays * 24 * 60 * 60 * 1000);

  const paidTodayWhere = { paidAt: { [Op.between]: [todayStart, todayEnd] } };
  const paidYesterdayWhere = { paidAt: { [Op.between]: [yesterdayStart, yesterdayEnd] } };

  const [
    ordersToday,
    ordersYesterday,
    gmvTodayRaw,
    gmvYesterdayRaw,
    activeAuctions,
    auctionsEndingSoon,
    newUsersToday,
    newUsersYesterday,
    ordersSeries,
    gmvSeries,
    newUsersSeries,
    lateShipments,
    paymentIncidents,
  ] = await Promise.all([
    Order.count({ where: paidTodayWhere }),
    Order.count({ where: paidYesterdayWhere }),
    Order.sum('totalCents', { where: paidTodayWhere }),
    Order.sum('totalCents', { where: paidYesterdayWhere }),
    Auction.count({ where: { status: 'live' } }),
    Auction.count({
      where: {
        status: 'live',
        endAt: { [Op.lte]: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),
    User.count({ where: { createdAt: { [Op.between]: [todayStart, todayEnd] } } }),
    User.count({ where: { createdAt: { [Op.between]: [yesterdayStart, yesterdayEnd] } } }),
    dailySeries(7, (start, end) =>
      Order.count({ where: { paidAt: { [Op.between]: [start, end] } } })
    ),
    dailySeries(7, async (start, end) => {
      const v = await Order.sum('totalCents', {
        where: { paidAt: { [Op.between]: [start, end] } },
      });
      const n = Number(v ?? 0);
      if (!Number.isFinite(n)) return 0;
      return n;
    }),
    dailySeries(7, (start, end) =>
      User.count({ where: { createdAt: { [Op.between]: [start, end] } } })
    ),
    OrderItem.count({
      where: {
        shippedAt: { [Op.is]: null },
        createdAt: { [Op.lt]: shipCutoff },
      },
    }),
    Order.count({
      where: {
        createdAt: { [Op.gte]: since24h },
        status: { [Op.in]: ['failed', 'cancelled'] },
      },
    }),
  ]);

  // This part replaces the OrderVendor.sum(... include: ...) that TS was complaining about
  const payoutRows = await OrderVendor.findAll({
    where: {
      payoutStatus: 'holding',
      holdUntil: { [Op.lte]: now },
    },
    attributes: ['vendorNetCents'],
    include: [
      {
        model: Order,
        as: 'order',
        required: true,
        attributes: [],
        where: { paidAt: { [Op.not]: null } },
      } as any,
    ],
  });

  const payoutsReadyCents = payoutRows.reduce((acc, row) => {
    const v = Number((row as any).vendorNetCents ?? 0);
    if (!Number.isFinite(v)) return acc;
    return acc + v;
  }, 0);

  const gmvTodayCents = Number(gmvTodayRaw ?? 0);
  const gmvYesterdayCents = Number(gmvYesterdayRaw ?? 0);

  return {
    ordersToday: Number(ordersToday) || 0,
    ordersYesterday: Number(ordersYesterday) || 0,
    gmvTodayCents: Number.isFinite(gmvTodayCents) ? gmvTodayCents : 0,
    gmvYesterdayCents: Number.isFinite(gmvYesterdayCents) ? gmvYesterdayCents : 0,
    activeAuctions: Number(activeAuctions) || 0,
    auctionsEndingSoon: Number(auctionsEndingSoon) || 0,
    newUsersToday: Number(newUsersToday) || 0,
    newUsersYesterday: Number(newUsersYesterday) || 0,
    ordersSeries,
    gmvSeries,
    newUsersSeries,
    lateShipments: Number(lateShipments) || 0,
    payoutsReadyCents,
    paymentIncidents: Number(paymentIncidents) || 0,
    // You don't have an email log table yet, so keep this as 0 for now
    emailIncidents: 0,
  };
}
