import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initializeSocket } from "./config/socket.js";
import { setupSocketHandlers } from "./socket/socket.handler.js";
import { initRedis } from "./config/redis.js";
import { initAIProviders } from "./config/ai.js";
import { initQueues } from "./config/queue.js";
import {
    startGenerationWorker,
    getGenerationWorker,
} from "./workers/generation.worker.js";
import {
    startEvaluationWorker,
    getEvaluationWorker,
} from "./workers/evaluation.worker.js";

const PORT = env.PORT;

async function bootstrap() {
    try {
        
        await initRedis();
        await initAIProviders();

        
        const httpServer = createServer(app);

        
        const io = initializeSocket(httpServer);
        setupSocketHandlers(io);

        initQueues();
        startGenerationWorker(io);
        startEvaluationWorker(io);

        app.set("io", io);

        
        httpServer.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📊 Environment: ${env.NODE_ENV}`);
            logger.info(`🌐 Frontend URL: ${env.FRONTEND_URL}`);
            logger.info(
                `🔗 Health check: http://localhost:${PORT}/api/v1/health`,
            );
        });

        
        const shutdown = async (signal) => {
            logger.info(`\n${signal} received — shutting down gracefully...`);

            const genWorker = getGenerationWorker();
            const evalWorker = getEvaluationWorker();
            if (genWorker) await genWorker.close();
            if (evalWorker) await evalWorker.close();
            logger.info("BullMQ workers closed");

            httpServer.close(() => {
                logger.info("HTTP server closed");
                process.exit(0);
            });

            setTimeout(() => {
                logger.error("Forced shutdown after timeout");
                process.exit(1);
            }, 10000);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        
        process.on("unhandledRejection", (reason) => {
            logger.error("Unhandled Rejection:", reason);
        });

        process.on("uncaughtException", (error) => {
            logger.error("Uncaught Exception:", error);
            process.exit(1);
        });
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}

bootstrap();
