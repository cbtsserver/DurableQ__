# DurableQ

> **A Production-Inspired Distributed Job Queue System**
> 
> Modern applications should respond quickly to users. Heavy tasks such as sending emails, generating invoices, processing images, or sending notifications should not block the user's request. Instead, these tasks are pushed into a background queue where workers process them asynchronously. To understand how systems like Amazon SQS, RabbitMQ, or BullMQ work internally, I built DurableQ from scratch using Node.js, TypeScript, PostgreSQL, and Express. Jobs are stored durably in PostgreSQL, workers claim them safely using PostgreSQL row-level locking, failed jobs are retried with exponential backoff, and permanently failed jobs are moved to a Dead Letter Queue. This makes the system reliable, fault-tolerant, and safe for concurrent processing.

## 📖 Overview

DurableQ is a production-inspired distributed job queue built from
scratch using **Node.js, TypeScript, PostgreSQL and Express.js**.

Instead of executing heavy tasks synchronously, DurableQ stores jobs in
a durable PostgreSQL queue where background workers safely process them.

## Features

-   Durable PostgreSQL-backed queue
-   Priority scheduling
-   Delayed / scheduled jobs
-   Automatic retries
-   Exponential backoff
-   Dead Letter Queue (DLQ)
-   Worker lease / visibility timeout
-   Concurrent workers using `FOR UPDATE SKIP LOCKED` (LEASE FEATURE)

## Architecture

``` text
                Client
                   │
          POST /enqueue
                   │
                   ▼
          PostgreSQL Jobs Table
                   │
        ┌──────────┴──────────┐
        │                     │
     Worker 1             Worker 2
        │                     │
        └────── Lease ─────────┘
                   │
          Process Business Logic
             │              │
          Success        Failure
             │              │
         Complete     Retry + Backoff
                            │
                     Max Retries?
                       │        │
                      No       Yes
                       │        ▼
                   Requeue     DLQ
```

## Tech Stack

-   Node.js
-   TypeScript
-   Express.js
-   PostgreSQL
-   pg

## Folder Structure

``` text
src/
├── api.ts
├── db.ts
├── initDb.ts
├── queue.ts
└── index.ts
```

## Database

### jobs

  Column         Purpose
  -------------- ---------------------
  id             Unique Job ID
  job_type       Type of task
  payload        JSON payload
  priority       Execution priority
  status         Current state
  retry_count    Retry attempts
  max_retries    Maximum retries
  run_at         Scheduled execution
  locked_until   Lease timeout
  created_at     Timestamp

### dead_letters

Stores permanently failed jobs for debugging and replay.

## Job Lifecycle

``` text
Enqueue
   │
Queued
   │
Lease Acquired
   │
Processing
 ┌─┴─────────┐
 │           │
Success   Failure
 │           │
Done    Retry→Backoff
             │
      Max Retries?
        │      │
       No     Yes
        │      ▼
     Requeue  DLQ
```

## Reliability

-   Crash-safe durable storage
-   Atomic job claiming
-   Duplicate execution prevention
-   Worker recovery using lease expiration
-   Fault-tolerant retry mechanism

## Getting Started

``` bash
git clone <repository-url>
cd DurableQ
npm install
npm run init-db
npm run dev
```
## Author

**Ayush Kumar Singh**

If you found this project helpful, consider giving it a ⭐.
