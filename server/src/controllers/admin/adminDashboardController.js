// V1.2 boundary only. Dashboard business endpoints belong to the Admin developer.
import Order from '../../models/Order.js';
import Ticket from '../../models/Ticket.js';
import Stall from '../../models/Stall.js';
import FoodItem from '../../models/FoodItem.js';

export const getDashboard = async (req, res) => {

    const totalOrders = await Order.countDocuments();

    const awaitingPayment = await Order.countDocuments({
        status: 'AWAITING_PAYMENT'
    });

    const paymentDeclared = await Order.countDocuments({
        status: 'PAYMENT_DECLARED'
    });

    const pendingPaymentReview = await Order.countDocuments({
        status: 'PAYMENT_SUBMITTED'
    });

    const approvedOrders = await Order.countDocuments({
        status: 'PAYMENT_APPROVED'
    });

    const rejectedOrders = await Order.countDocuments({
        status: 'PAYMENT_REJECTED'
    });

    const expiredOrders = await Order.countDocuments({
        status: 'EXPIRED'
    });

    const ticketsSold = await Ticket.countDocuments({
        status: { $in: ['ACTIVE', 'REDEEMED'] }
    });

    const ticketsRedeemed = await Ticket.countDocuments({
        status: 'REDEEMED'
    });

    const activeStalls = await Stall.countDocuments({
        isActive: true
    });

    const availableFoods = await FoodItem.countDocuments({
        isAvailable: true
    });

    const revenueResult = await Order.aggregate([
        {
            $match: {
                status: 'PAYMENT_APPROVED'
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$totalAmount' }
            }
        }
    ]);

    const approvedRevenue = revenueResult[0]?.total || 0;

    res.json({
        totalOrders,
        awaitingPayment,
        paymentDeclared,
        pendingPaymentReview,
        approvedOrders,
        rejectedOrders,
        expiredOrders,
        ticketsSold,
        ticketsRedeemed,
        activeStalls,
        availableFoods,
        approvedRevenue
    });
};