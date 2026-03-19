import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const redis_client = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT) 
    }
});

export const connectRedis = async () => {
    try {
        await redis_client.connect();
        console.log(" Connected to Redis successfully!");
    } catch (err) {
        console.error(" Redis Connection Error:", err);
    }
};
