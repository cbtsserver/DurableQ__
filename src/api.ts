import express from 'express';
import cors from 'cors';
import { pool } from './db';
import { enqueueJob } from './queue';

const app = express();
app.use(cors());
app.use(express.json());

// 1. STATS ENDPOINT: Queue mein kitne jobs hain aur kis haalat mein hain?
app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM jobs 
            GROUP BY status
        `);
        
        // Ek simple object banate hain bhejne ke liye
        const stats = { queued: 0, processing: 0, failed: 0 };
        result.rows.forEach(row => {
            stats[row.status as keyof typeof stats] = parseInt(row.count);
        });
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. LIVE JOBS ENDPOINT: Queue aur processing wale jobs dekhne ke liye
app.get('/api/jobs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, job_type, payload, status, retry_count, run_at, locked_until 
            FROM jobs 
            ORDER BY id DESC LIMIT 20
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 3. DLQ ENDPOINT: Graveyard mein kaunse jobs pade hain?
app.get('/api/dlq', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM dead_letters ORDER BY failed_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 4. "CHAOS BUTTON" ENDPOINT: UI se naya job daalne ke liye
app.post('/api/add-job', async (req, res) => {
    try {
        const { type, payload } = req.body;
        const jobId = await enqueueJob(type || 'MANUAL_UI_JOB', payload || { source: 'Web UI' });
        res.json({ message: 'Job added successfully', jobId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add job' });
    }
});


// 5. CLEAR DLQ ENDPOINT: Graveyard ko poora khali karne ke liye
app.delete('/api/dlq/clear', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE dead_letters');
        res.json({ message: 'Graveyard cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear graveyard' });
    }
});

// Server Start karne ka function
export const startApiServer = () => {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`🌐 API Server chal raha hai: http://localhost:${PORT}`);
    });
};