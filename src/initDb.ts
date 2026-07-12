import { pool } from './db';

const initializeDatabase = async () => {
    const client = await pool.connect();
    
    try {
        console.log('⏳ Database tables set up kar rahe hain...');

        // 1. Job Status ke liye ek ENUM type banana
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE job_status AS ENUM ('queued', 'processing', 'failed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // 2. Main Jobs Table Create Karna
        await client.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                job_type VARCHAR(100) NOT NULL,
                payload JSONB NOT NULL,
                priority INT DEFAULT 0,
                status job_status DEFAULT 'queued',
                retry_count INT DEFAULT 0,
                max_retries INT DEFAULT 5,
                run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                locked_until TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Performance ke liye index (Taki worker fast query kar sake)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_jobs_fetch 
            ON jobs (priority DESC, run_at ASC) 
            WHERE status = 'queued';
        `);

        // 3. Dead-Letter Queue (DLQ) Table Create Karna
        await client.query(`
            CREATE TABLE IF NOT EXISTS dead_letters (
                id INT PRIMARY KEY,
                job_type VARCHAR(100) NOT NULL,
                payload JSONB NOT NULL,
                failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                error_reason TEXT
            );
        `);

        console.log('✅ Badiya! `jobs` aur `dead_letters` tables ready hain.');

    } catch (error) {
        console.error('❌ Error aayi table banane mein:', error);
    } finally {
        client.release();
        pool.end(); // Script khatam hone par connection close karna
    }
};

initializeDatabase();