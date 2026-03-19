import { redis_client } from "./redis.connect.js";

export const setValue = async ({ key, value, ttl }) => {
    try {
        const data = typeof value === "string" ? value : JSON.stringify(value);
        return ttl 
            ? await redis_client.set(key, data, { EX: Number(ttl) }) 
            : await redis_client.set(key, data);
    } catch (error) {
        console.error("fail to set operation", error);
    }
};

export const update = async ({ key, value, ttl }) => {
    try {
        const isExists = await redis_client.exists(key);
        if (!isExists) return 0;
        return await setValue({ key, value, ttl });
    } catch (error) {
        console.error("fail to update operation", error);
    }
};

export const get = async (key) => {
    try {
        const data = await redis_client.get(key);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    } catch (error) {
        console.error("fail to get operation", error);
    }
};

export const getTTL = async (key) => { 
    try {
        return await redis_client.ttl(key);
    } catch (error) {
        console.error("fail to get TTL operation", error);
    }
};

export const isExist = async (key) => {
    try {
        return await redis_client.exists(key);
    } catch (error) {
        console.error("fail to check existence", error);
    }
};

export const deleteKey = async (key) => {
    try {
        return await redis_client.del(key);
    } catch (error) {
        console.error("fail to delete key", error);
    }
};