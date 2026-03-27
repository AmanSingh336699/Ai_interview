import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { httpLogger } from "./config/logger.js";
import {
    errorHandler,
    notFoundHandler,
} from "./middleware/error.middleware.js";
import { generalLimiter } from "./middleware/rateLimit.middleware.js";


import authRoutes from "./modules/auth/auth.routes.js";
import interviewRoutes from "./modules/interview/interview.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";

const app = express();

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
);


const allowedOrigins = [
    ...env.FRONTEND_URL.split(",").map((url) => url.trim()),
    "http://localhost:5173",
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (
                allowedOrigins.indexOf(origin) !== -1 ||
                allowedOrigins.includes("*")
            ) {
                callback(null, true);
            } else {
                console.warn(`CORS blocked request from origin: ${origin}`);
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);


app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));


app.use(cookieParser());


app.use(httpLogger);


app.use("/api/", generalLimiter);


app.get("/api/v1/health", (req, res) => {
    res.json({
        success: true,
        message: "AI Mock Interviewer API is running",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});


app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/interview", interviewRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/admin", adminRoutes);






app.use(notFoundHandler);


app.use(errorHandler);

export default app;
