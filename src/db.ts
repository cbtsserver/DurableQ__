import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Pool humein database se connect karne mein madad karta hai
export const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Choti si test function
export const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('🔥 Bawaal! TypeScript aur PostgreSQL connect ho gaye!');
        client.release();
    } catch (err) {
        console.error('❌ Connection fail ho gaya bhai:', err);
    }
};