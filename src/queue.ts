import { pool } from './db';

/**
 * 1. ENQUEUE: Naya job queue mein daalne ke liye
 */
export const enqueueJob = async (
    jobType: string, 
    payload: any, 
    priority: number = 0, 
    delaySeconds: number = 0
) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO jobs (job_type, payload, priority, run_at)
            VALUES ($1, $2, $3, NOW() + INTERVAL '${delaySeconds} seconds')
            RETURNING id;
        `;
        const values = [jobType, JSON.stringify(payload), priority];
        const result = await client.query(query, values);
        
        console.log(`📥 Job Enqueued: [${jobType}] (ID: ${result.rows[0].id})`);
        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Enqueue Error:', error);
    } finally {
        client.release();
    }
};

/**
 * 2. FETCH NEXT JOB: Worker ke liye safely naya job uthana
 */
export const fetchNextJob = async () => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE jobs
            SET status = 'processing',
                locked_until = NOW() + INTERVAL '10 seconds'
            WHERE id = (
                SELECT id 
                FROM jobs 
                WHERE (status = 'queued' OR (status = 'processing' AND locked_until < NOW()))
                  AND run_at <= NOW()
                ORDER BY priority DESC, run_at ASC 
                LIMIT 1 
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *;
        `;
        
        const result = await client.query(query);
        
        if (result.rows.length > 0) {
            return result.rows[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error('❌ Fetch Job Error:', error);
        return null;
    } finally {
        client.release();
    }
};

/**
 * 3. COMPLETE JOB: Job successful hone par usko main table se delete karna
 */
export const completeJob = async (jobId: number) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM jobs WHERE id = $1`, [jobId]);
        console.log(`✅ Job [ID: ${jobId}] successfully complete aur delete ho gaya!`);
    } catch (error) {
        console.error('❌ Complete Job Error:', error);
    } finally {
        client.release();
    }
};

/**
 * 4. FAIL JOB: Retry logic aur Exponential Backoff (Requirement #03 & #04)
 */
export const failJob = async (jobId: number, errorMessage: string) => {
    const client = await pool.connect();
    try {
        const result = await client.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
        const job = result.rows[0];

        if (!job) return;

        const nextRetryCount = job.retry_count + 1;

        // 🚨 YAHAN CHANGE KIYA HAI: Ab 3 retries ke baad direct DLQ mein jayega
        if (nextRetryCount > 3) {
            // MAX RETRIES REACHED -> Dead Letter Queue mein daalo
            await client.query(`
                INSERT INTO dead_letters (id, job_type, payload, error_reason)
                VALUES ($1, $2, $3, $4)
            `, [job.id, job.job_type, JSON.stringify(job.payload), errorMessage]);
            
            // Aur main table se hata do
            await client.query(`DELETE FROM jobs WHERE id = $1`, [jobId]);
            console.log(`💀 Job [ID: ${jobId}] mar gaya. Moved to Dead-Letter Queue (DLQ).`);
        } else {
            // EXPONENTIAL BACKOFF: 2^1 = 2s, 2^2 = 4s, 2^3 = 8s
            const backoffSeconds = Math.pow(2, nextRetryCount); 
            
            await client.query(`
                UPDATE jobs 
                SET status = 'queued',
                    retry_count = $1,
                    run_at = NOW() + INTERVAL '${backoffSeconds} seconds',
                    locked_until = NULL
                WHERE id = $2
            `, [nextRetryCount, jobId]);
            
            console.log(`⚠️ Job [ID: ${jobId}] fail hua. Retry #${nextRetryCount} hoga ${backoffSeconds} second baad.`);
        }
    } catch (error) {
        console.error('❌ Fail Job Error:', error);
    } finally {
        client.release();
    }
};