
import * as paymentService from "./payment.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../config/logger.js";



export async function createOrder(req, res, next) {
    try {
        const userId = req.user.id; 
        const { plan } = req.body;

        if (!plan) {
            throw ApiError.badRequest("Plan is required");
        }

        const result = await paymentService.createOrder(
            userId,
            plan.toUpperCase(),
        );
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}



export async function verifyPayment(req, res, next) {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
            req.body;

        
        
        const result = await paymentService.verifyPayment({
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
        });

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}



export async function handleWebhook(req, res, next) {
    try {
        
        const signature = req.headers["x-razorpay-signature"];

        if (!signature) {
            throw ApiError.badRequest("Missing webhook signature header");
        }

        const result = await paymentService.handleWebhook(
            req.rawBody,
            signature,
        );
        res.status(200).json(result);
    } catch (err) {
        
        logger.error({ err }, "Webhook processing failed");
        res.status(200).json({ received: true, error: err.message });
    }
}



export async function getSubscription(req, res, next) {
    try {
        const result = await paymentService.getSubscription(req.user.id);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}



export async function getPaymentHistory(req, res, next) {
    try {
        const result = await paymentService.getPaymentHistory(req.user.id);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}
