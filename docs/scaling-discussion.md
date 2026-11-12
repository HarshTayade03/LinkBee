# Scaling Discussion: Scaling the URL Shortener to Millions of Users

In senior engineering interviews at companies like PayPal, Stripe, and Uber, candidates are expected to demonstrate how a working single-node architecture evolves as traffic scales by factors of $10\times$, $100\times$, and $1,000\times$.

---

## 1. Growth Milestones & Architectural Evolution

| Scale Tier | Daily Clicks | Read QPS (Peak) | Storage / Year | Architecture Topology | Primary Bottlenecks |
|---|---|---|---|---|---|
| **Tier 1: Current** (MVP / Portfolio) | $10,000$ | $50\text{--}100$ | $< 5\text{ GB}$ | Single Express monolith + Neon Postgres + Upstash Redis | Single node compute / cold starts |
| **Tier 2: Growth Startup** | $5,000,000$ | $1,500\text{--}3,000$ | $50\text{ GB}$ | Multi-instance Node.js on ECS/K8s + AWS Aurora (1 Primary + 2 Replicas) + Redis Cluster | Database connection exhaustion, Click write throughput |
| **Tier 3: Enterprise Scale** (Bitly / PayPal) | $500,000,000$ | $50,000\text{--}150,000$ | $5\text{ TB}$ | Edge CDN Redirection (Cloudflare Workers / KV) + Sharded NoSQL/Postgres + Kafka + ClickHouse OLAP | Network ingress, global latency, OLAP vs OLTP contention |

---

## 2. Deep Dive: Architectural Upgrades for Enterprise Scale

### A. Moving Redirection to the Global Edge
- **Problem**: In a centralized deployment (e.g., AWS `us-east-1`), a user in Singapore clicking a link must endure a 250ms round-trip latency across undersea cables just to fetch a 302 redirect.
- **Solution**:
  - Deploy redirection logic to **Edge Workers** (Cloudflare Workers, AWS CloudFront Functions, Fastly Compute@Edge).
  - Use an ultra-low-latency distributed Key-Value store (Cloudflare KV or Upstash Global Redis).
  - Cache hits resolve at the nearest Point of Presence (PoP) in **$<15\text{ms}$**, completely bypassing origin servers.
  - Only cache misses fall back to the origin PostgreSQL database.

### B. Database Sharding & Partitioning
- **Horizontal Sharding Strategy**:
  - Shard keys: `hash(short_code) % N_shards`.
  - Consistent Hashing ring prevents massive re-sharding rebalances when adding new database nodes.
- **Table Partitioning**:
  - Partition the `clicks` table by monthly date range (`RANGE (clicked_at)`).
  - Facilitates instant archiving or dropping of old analytics partitions via DDL without running long-running disk-locking `DELETE` queries.

### C. Decoupled Click Streaming with Apache Kafka
- **Problem**: Writing every click directly to PostgreSQL in the redirection path saturates the database write-ahead log (WAL) and disk I/O.
- **Solution**:
  - Edge worker or backend service publishes click events to an **Apache Kafka** topic partitioned by `url_id`.
  - Consumer groups consume events in micro-batches (e.g., 5,000 events or every 1 second).
  - Batch insert into an **OLAP database** optimized for analytical queries (e.g., **ClickHouse** or **Amazon Redshift**).
  - PostgreSQL remains lean and dedicated purely to URL mappings and user auth records.

```
[ User Clicks Link ]
         │
         ▼
[ Edge CDN Worker ] ──(Cache Hit <15ms)──► [ 302 Redirect ]
         │
         ├────────────────────────────────────────┐
   (Cache Miss)                                   │ (Async Log Event)
         ▼                                        ▼
[ Primary Database ]                       [ Apache Kafka ]
  (Reads URL & populates Edge Cache)              │
                                                  ▼
                                         [ Consumer Batcher ]
                                                  │
                                                  ▼
                                       [ ClickHouse OLAP DB ]
                                                  │
                                                  ▼
                                       [ Creator Analytics UI ]
```

---

## 3. Storage & Bandwidth Math (The Envelope Calculations)

When asked: *"Estimate the database storage and egress bandwidth required for Bitly-scale operations."*

### Assumptions:
- **New URLs created**: 100 million per month (~40 writes/sec).
- **Redirections**: 10 billion per month (~4,000 reads/sec average, 15,000 peak).
- **Retention**: 5 years.

### Storage Calculations:
- `urls` row:
  - `id`: 8 bytes
  - `short_code`: 7 bytes
  - `original_url`: ~100 bytes average
  - `user_id`: 8 bytes
  - `created_at`: 8 bytes
  - Indexes & metadata overhead: ~100 bytes
  - **Total per URL**: $\approx 250\text{ bytes}$.
- 100M URLs/month $\times$ 12 months $\times$ 5 years = **6 Billion URLs**.
- Storage for URLs = $6 \times 10^9 \times 250\text{ bytes} \approx \mathbf{1.5\text{ Terabytes}}$.
- *Takeaway for interview*: 1.5 TB over 5 years is easily manageable even on a single modern database instance with attached SSD storage! Storage is not the bottleneck; **read QPS and analytics ingestion are the true bottlenecks**.

### Bandwidth Calculations:
- Redirection response size: ~500 bytes (headers, 302 status, Location header).
- Peak reads: 15,000 req/sec.
- Egress Bandwidth = $15,000 \times 500\text{ bytes} = 7.5\text{ MB/sec} \approx \mathbf{60\text{ Mbps}}$.
- Very modest bandwidth requirement, making CDN edge caching extremely cost-effective.
