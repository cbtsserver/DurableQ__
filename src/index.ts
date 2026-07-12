import { testConnection } from './db';
import { enqueueJob, fetchNextJob, completeJob, failJob } from './queue';
import { startApiServer } from './api';
// Ek chota function jo execution ko thodi der rokne (simulate) ke kaam aayega
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processJob = async (job: any) => {
    console.log(`\n⚙️ Processing Job [ID: ${job.id}] | Type: ${job.job_type}`);
    
    // Simulate API call ya heavy task (2 second time lega)
    await sleep(2000); 

    // Jaan-bujh kar kuch jobs fail karenge test karne ke liye!
    // Agar random number 0.5 se chota hai, toh hum fail kar denge
    if (Math.random() < 0.5) {
        throw new Error("Network timeout ya API fail ho gayi!");
    }

    console.log(`🎉 Task poora hua:`, job.payload);
};

const startWorkerLoop = async () => {
    console.log('🤖 Continuous Worker chalu ho gaya hai...');

    while (true) {
        const job = await fetchNextJob();

        if (job) {
            try {
                // Job process karne ki koshish karo
                await processJob(job);
                
                // Agar bina error ke yahan tak aa gaya, matlab success
                await completeJob(job.id);
            } catch (error: any) {
                // Agar catch mein aaya, matlab fail hua
                await failJob(job.id, error.message);
            }
        } else {
            // Agar queue khali hai, toh 3 second wait karo aur phir check karo
            // Isse database pe load nahi padega
            await sleep(3000);
        }
    }
};

const run = async () => {
    await testConnection();

    // API Server Start Karo
    startApiServer();

    // Worker loop start kar do
    startWorkerLoop();
    
    await testConnection();

    // Test ke liye ek dummy job daal dete hain
    await enqueueJob('SEND_WELCOME_EMAIL', { userId: 101 }, 5);
    
    // Worker loop start kar do
    startWorkerLoop();
};

run();