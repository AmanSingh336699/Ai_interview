
import express from "express";
import * as controller from "./payment.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router = express.Router();




router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    
    (req, _res, next) => {
        req.rawBody = req.body;
        next();
    },
    controller.handleWebhook,
);


router.use(requireAuth); 

router.post("/create-order", controller.createOrder);
router.post("/verify", controller.verifyPayment);
router.get("/subscription", controller.getSubscription);
router.get("/history", controller.getPaymentHistory);

export default router;
