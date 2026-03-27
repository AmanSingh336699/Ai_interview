import { Server } from "socket.io";
import { env } from "./env.js";
import { logger } from "./logger.js";

export function initializeSocket(httpServer) {
    const allowedOrigins = [
        ...env.FRONTEND_URL.split(",").map((url) => url.trim()),
        "http://localhost:5173",
    ];

    const io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (
                    !origin ||
                    allowedOrigins.indexOf(origin) !== -1 ||
                    allowedOrigins.includes("*")
                ) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            },
            methods: ["GET", "POST"],
            credentials: true,
        },
        transports: ["websocket", "polling"],
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    
    if (env.REDIS_URL) {
        import("ioredis")
            .then(({ default: Redis }) => {
                const pubClient = new Redis(env.REDIS_URL);
                const subClient = pubClient.duplicate();

                import("@socket.io/redis-adapter").then(({ createAdapter }) => {
                    io.adapter(createAdapter(pubClient, subClient));
                    logger.info("✅ Socket.io Redis adapter attached");
                });
            })
            .catch((err) => {
                logger.warn(
                    "⚠️  Socket.io Redis adapter failed, using default:",
                    err.message,
                );
            });
    }

    return io;
}
