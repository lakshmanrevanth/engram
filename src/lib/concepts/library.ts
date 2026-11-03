// Built-in library of system design concepts.
//
// Each concept has a category, a level (mapped to difficulty), a one-line summary,
// and recall prompts: questions to answer from memory before rating a review.
// Users can also add their own concepts that aren't in this list.

export type ConceptLevel = 'EASY' | 'MEDIUM' | 'HARD';

export type Concept = {
  slug: string;
  title: string;
  category: string;
  level: ConceptLevel;
  summary: string;
  prompts: string[];
};

export const CONCEPT_CATEGORIES = [
  'Fundamentals',
  'Networking',
  'Storage',
  'Caching',
  'Messaging',
  'Distributed Systems',
  'Reliability',
  'Architecture',
  'Observability',
  'Case Study',
] as const;

export const CONCEPTS: Concept[] = [
  // Fundamentals
  {
    slug: 'scalability',
    title: 'Vertical vs horizontal scaling',
    category: 'Fundamentals',
    level: 'EASY',
    summary: 'Scale up with a bigger machine, or scale out by adding machines behind a load balancer.',
    prompts: [
      'What limits vertical scaling?',
      'What must be true of a service before it can scale horizontally?',
      'Why does horizontal scaling usually need stateless app servers?',
    ],
  },
  {
    slug: 'latency-throughput',
    title: 'Latency vs throughput',
    category: 'Fundamentals',
    level: 'EASY',
    summary: 'Latency is time per request; throughput is requests per unit time. Optimising one can hurt the other.',
    prompts: [
      'Give an example where batching raises throughput but also latency.',
      'Why do we look at p99 latency rather than the average?',
      'Roughly how long is a memory read vs an SSD read vs a cross-region round trip?',
    ],
  },
  {
    slug: 'back-of-envelope',
    title: 'Back-of-the-envelope estimation',
    category: 'Fundamentals',
    level: 'EASY',
    summary: 'Estimate QPS, storage and bandwidth from users and usage to size a system before designing it.',
    prompts: [
      'How do you get average and peak QPS from daily active users?',
      'Estimate storage per year for 10M new 1 KB records per day.',
      'Why is it fine to round aggressively in these estimates?',
    ],
  },
  {
    slug: 'cap-theorem',
    title: 'CAP theorem',
    category: 'Fundamentals',
    level: 'MEDIUM',
    summary: 'During a network partition a distributed store must choose between consistency and availability.',
    prompts: [
      'Why is "pick 2 of 3" a misleading summary of CAP?',
      'Give one CP system and one AP system and explain the choice.',
      'What does a CP system do with requests during a partition?',
    ],
  },
  {
    slug: 'pacelc',
    title: 'PACELC',
    category: 'Fundamentals',
    level: 'MEDIUM',
    summary: 'Extends CAP: if Partitioned choose A or C; Else choose Latency or Consistency.',
    prompts: [
      'What trade-off does PACELC add that CAP ignores?',
      'Classify DynamoDB-style stores under PACELC.',
      'Why does synchronous replication increase latency even without partitions?',
    ],
  },
  {
    slug: 'consistency-models',
    title: 'Consistency models',
    category: 'Fundamentals',
    level: 'HARD',
    summary: 'Strong, linearizable, sequential, causal, read-your-writes and eventual consistency give different guarantees.',
    prompts: [
      'What does linearizability guarantee that eventual consistency does not?',
      'Describe a bug that read-your-writes consistency prevents.',
      'Where is eventual consistency an acceptable trade-off?',
    ],
  },

  // Networking
  {
    slug: 'dns',
    title: 'DNS',
    category: 'Networking',
    level: 'EASY',
    summary: 'Resolves names to IP addresses through recursive resolvers, root, TLD and authoritative servers, with caching via TTLs.',
    prompts: [
      'Walk through resolving a domain from a cold cache.',
      'What does TTL trade off?',
      'How can DNS be used for load balancing or failover, and what are its limits?',
    ],
  },
  {
    slug: 'cdn',
    title: 'CDN',
    category: 'Networking',
    level: 'EASY',
    summary: 'Edge servers cache content close to users to cut latency and origin load.',
    prompts: [
      'Push vs pull CDN: when would you use each?',
      'How do you invalidate content that is cached at the edge?',
      'What kinds of content should not be cached on a CDN?',
    ],
  },
  {
    slug: 'load-balancing',
    title: 'Load balancing',
    category: 'Networking',
    level: 'EASY',
    summary: 'Distributes requests across servers using algorithms like round robin, least connections or hashing, at L4 or L7.',
    prompts: [
      'What is the difference between L4 and L7 load balancing?',
      'When is least-connections better than round robin?',
      'How do you avoid the load balancer itself being a single point of failure?',
    ],
  },
  {
    slug: 'reverse-proxy-api-gateway',
    title: 'Reverse proxy and API gateway',
    category: 'Networking',
    level: 'MEDIUM',
    summary: 'A single entry point that handles TLS, routing, auth, rate limiting and request aggregation in front of services.',
    prompts: [
      'What responsibilities belong in an API gateway and which do not?',
      'How is a reverse proxy different from a load balancer?',
      'What risk does a gateway add, and how is it mitigated?',
    ],
  },
  {
    slug: 'realtime-transport',
    title: 'Polling, long polling, SSE and WebSockets',
    category: 'Networking',
    level: 'MEDIUM',
    summary: 'Ways for a server to push updates: repeated requests, held requests, a one-way stream, or a full-duplex socket.',
    prompts: [
      'When is SSE enough and when do you need WebSockets?',
      'Why do WebSockets make load balancing and scaling harder?',
      'What does long polling cost the server compared with WebSockets?',
    ],
  },
  {
    slug: 'rest-grpc-graphql',
    title: 'REST vs gRPC vs GraphQL',
    category: 'Networking',
    level: 'MEDIUM',
    summary: 'Resource-oriented HTTP APIs, binary RPC over HTTP/2 with schemas, or client-shaped queries over one endpoint.',
    prompts: [
      'Why is gRPC common between internal services but rarer for browsers?',
      'What problem does GraphQL solve, and what new problems does it create?',
      'How do you version a REST API?',
    ],
  },

  // Storage
  {
    slug: 'sql-vs-nosql',
    title: 'SQL vs NoSQL',
    category: 'Storage',
    level: 'EASY',
    summary: 'Relational stores give schemas, joins and transactions; NoSQL (key-value, document, wide-column, graph) trades those for scale or flexibility.',
    prompts: [
      'Name the four main NoSQL families and a use case for each.',
      'When is a relational database still the right default?',
      'What do you lose when you denormalise data for a NoSQL store?',
    ],
  },
  {
    slug: 'acid-base',
    title: 'ACID vs BASE',
    category: 'Storage',
    level: 'MEDIUM',
    summary: 'ACID: atomic, consistent, isolated, durable transactions. BASE: basically available, soft state, eventually consistent.',
    prompts: [
      'Explain each letter of ACID with an example.',
      'Which isolation level prevents phantom reads?',
      'Why do many large-scale stores choose BASE?',
    ],
  },
  {
    slug: 'indexing',
    title: 'Database indexing',
    category: 'Storage',
    level: 'MEDIUM',
    summary: 'Indexes (usually B-trees) speed up reads at the cost of slower writes and extra storage.',
    prompts: [
      'Why does column order matter in a composite index?',
      'What is a covering index?',
      'Why can too many indexes hurt a write-heavy table?',
    ],
  },
  {
    slug: 'btree-vs-lsm',
    title: 'B-tree vs LSM-tree storage',
    category: 'Storage',
    level: 'HARD',
    summary: 'B-trees update pages in place and suit reads; LSM-trees append to memtables and SSTables and suit heavy writes, with compaction.',
    prompts: [
      'Why are LSM-trees faster for writes?',
      'What is compaction, and what does it cost?',
      'How do bloom filters help LSM-tree reads?',
    ],
  },
  {
    slug: 'replication',
    title: 'Replication',
    category: 'Storage',
    level: 'MEDIUM',
    summary: 'Copies data across nodes: leader-follower, multi-leader or leaderless, synchronous or asynchronous.',
    prompts: [
      'What is replication lag and what bugs does it cause?',
      'When would you use multi-leader replication, and what conflict does it create?',
      'Sync vs async replication: what does each risk?',
    ],
  },
  {
    slug: 'sharding',
    title: 'Sharding and partitioning',
    category: 'Storage',
    level: 'MEDIUM',
    summary: 'Splits data across nodes by key range or hash so each node holds part of the data.',
    prompts: [
      'Range vs hash partitioning: trade-offs?',
      'What is a hot shard and how do you fix one?',
      'Why are cross-shard joins and transactions hard?',
    ],
  },
  {
    slug: 'consistent-hashing',
    title: 'Consistent hashing',
    category: 'Storage',
    level: 'MEDIUM',
    summary: 'Places nodes and keys on a hash ring so adding or removing a node moves only about 1/N of keys; virtual nodes balance load.',
    prompts: [
      'Why does hash(key) % N break when N changes?',
      'What problem do virtual nodes solve?',
      'Which systems use consistent hashing?',
    ],
  },
  {
    slug: 'write-ahead-log',
    title: 'Write-ahead log',
    category: 'Storage',
    level: 'MEDIUM',
    summary: 'Changes are appended to a durable log before being applied, so the store can recover after a crash.',
    prompts: [
      'How does a WAL make crash recovery possible?',
      'How is the WAL also used for replication?',
      'Why is appending to a log fast?',
    ],
  },
  {
    slug: 'blob-storage',
    title: 'Object / blob storage',
    category: 'Storage',
    level: 'EASY',
    summary: 'Stores large immutable files (images, video, backups) cheaply with metadata kept elsewhere.',
    prompts: [
      'Why not store images in the main database?',
      'What are pre-signed upload URLs and why use them?',
      'How do you serve blobs efficiently to users worldwide?',
    ],
  },

  // Caching
  {
    slug: 'caching-strategies',
    title: 'Caching strategies',
    category: 'Caching',
    level: 'MEDIUM',
    summary: 'Cache-aside, read-through, write-through, write-back and write-around differ in who fills the cache and when writes reach the store.',
    prompts: [
      'Describe cache-aside reads and writes step by step.',
      'What does write-back risk, and why is it fast?',
      'Which strategy suits a read-heavy profile page?',
    ],
  },
  {
    slug: 'cache-eviction',
    title: 'Cache eviction policies',
    category: 'Caching',
    level: 'EASY',
    summary: 'LRU, LFU, FIFO and TTL decide what to drop when the cache is full or stale.',
    prompts: [
      'How would you implement an O(1) LRU cache?',
      'When does LFU beat LRU?',
      'What does a TTL protect against?',
    ],
  },
  {
    slug: 'cache-invalidation',
    title: 'Cache invalidation and stampedes',
    category: 'Caching',
    level: 'HARD',
    summary: 'Keeping caches fresh, and preventing many requests from hitting the database at once when a hot key expires.',
    prompts: [
      'Delete vs update the cache on write: which is safer and why?',
      'What is a cache stampede (thundering herd)? Give two fixes.',
      'How do you handle a hot key that every request reads?',
    ],
  },

  // Messaging
  {
    slug: 'message-queues',
    title: 'Message queues',
    category: 'Messaging',
    level: 'EASY',
    summary: 'Producers put work on a queue and consumers process it asynchronously, decoupling services and smoothing spikes.',
    prompts: [
      'What problems does a queue solve between two services?',
      'What is a dead-letter queue?',
      'At-most-once vs at-least-once delivery: what does each mean for consumers?',
    ],
  },
  {
    slug: 'pub-sub-kafka',
    title: 'Pub/sub and log-based brokers (Kafka)',
    category: 'Messaging',
    level: 'MEDIUM',
    summary: 'Topics are append-only partitioned logs; consumer groups read at their own offsets and can replay.',
    prompts: [
      'How does Kafka keep ordering, and only within what scope?',
      'What is a consumer group and how is work split across it?',
      'How is a log broker different from a traditional queue?',
    ],
  },
  {
    slug: 'idempotency',
    title: 'Idempotency and exactly-once',
    category: 'Messaging',
    level: 'MEDIUM',
    summary: 'Retries are safe when repeating an operation has the same effect; idempotency keys and dedup tables make this possible.',
    prompts: [
      'Why is true exactly-once delivery so hard?',
      'How does an idempotency key on a payment API work?',
      'Which HTTP methods are idempotent by definition?',
    ],
  },
  {
    slug: 'backpressure',
    title: 'Backpressure',
    category: 'Messaging',
    level: 'MEDIUM',
    summary: 'Slowing or rejecting producers when consumers fall behind, instead of letting queues grow without bound.',
    prompts: [
      'What happens without backpressure when consumers are slow?',
      'Name three ways to apply backpressure.',
      'How do you monitor whether consumers are keeping up?',
    ],
  },

  // Distributed systems
  {
    slug: 'leader-election',
    title: 'Leader election',
    category: 'Distributed Systems',
    level: 'HARD',
    summary: 'Nodes agree on a single coordinator, typically using leases and a consensus system such as ZooKeeper or etcd.',
    prompts: [
      'What is split brain and how do fencing tokens prevent damage?',
      'Why are leases time-bounded?',
      'What happens to writes while a new leader is being elected?',
    ],
  },
  {
    slug: 'consensus-raft',
    title: 'Consensus (Raft / Paxos)',
    category: 'Distributed Systems',
    level: 'HARD',
    summary: 'A majority of nodes agree on an ordered log of values so the cluster survives minority failures.',
    prompts: [
      'Describe Raft leader election and log replication.',
      'Why does a 5-node cluster tolerate 2 failures but not 3?',
      'Why is consensus too slow for every request in a large system?',
    ],
  },
  {
    slug: 'quorum',
    title: 'Quorums (R + W > N)',
    category: 'Distributed Systems',
    level: 'MEDIUM',
    summary: 'With N replicas, choosing read and write quorums where R + W > N ensures reads overlap the latest write.',
    prompts: [
      'Why does R + W > N give overlap?',
      'Pick R and W for a write-heavy workload with N = 3.',
      'What are sloppy quorums and hinted handoff?',
    ],
  },
  {
    slug: 'clocks',
    title: 'Clocks: logical, vector, hybrid',
    category: 'Distributed Systems',
    level: 'HARD',
    summary: 'Wall clocks drift, so systems order events with Lamport clocks, vector clocks or hybrid logical clocks.',
    prompts: [
      'Why is "last write wins" by timestamp dangerous?',
      'What can vector clocks detect that Lamport clocks cannot?',
      'How does Google Spanner use TrueTime?',
    ],
  },
  {
    slug: 'distributed-transactions',
    title: 'Two-phase commit and sagas',
    category: 'Distributed Systems',
    level: 'HARD',
    summary: '2PC coordinates an atomic commit across nodes; sagas split work into local steps with compensating actions.',
    prompts: [
      'Why does 2PC block if the coordinator fails?',
      'Design a saga for booking a flight, hotel and car.',
      'Orchestration vs choreography for sagas?',
    ],
  },
  {
    slug: 'distributed-locks',
    title: 'Distributed locks',
    category: 'Distributed Systems',
    level: 'HARD',
    summary: 'Mutual exclusion across machines with TTL-based locks, which need fencing tokens to be safe.',
    prompts: [
      'Why can a process think it holds a lock after it expired?',
      'How do fencing tokens make locks safe?',
      'When can you avoid a distributed lock entirely?',
    ],
  },
  {
    slug: 'gossip-heartbeats',
    title: 'Gossip and failure detection',
    category: 'Distributed Systems',
    level: 'MEDIUM',
    summary: 'Nodes share membership and health by gossiping with random peers; heartbeats and timeouts detect failures.',
    prompts: [
      'Why does gossip scale better than all-to-all heartbeats?',
      'What makes timeout-based failure detection imperfect?',
      'What is a phi-accrual failure detector?',
    ],
  },

  // Reliability
  {
    slug: 'rate-limiting',
    title: 'Rate limiting algorithms',
    category: 'Reliability',
    level: 'MEDIUM',
    summary: 'Token bucket, leaky bucket, fixed window and sliding window cap how many requests a client can make.',
    prompts: [
      'Token bucket vs fixed window: what burst behaviour does each allow?',
      'How do you rate limit across many servers?',
      'What should the response look like when a client is limited?',
    ],
  },
  {
    slug: 'retries-backoff',
    title: 'Retries, timeouts, backoff and jitter',
    category: 'Reliability',
    level: 'EASY',
    summary: 'Retry transient failures with timeouts, exponential backoff and random jitter to avoid synchronized retry storms.',
    prompts: [
      'Why add jitter to exponential backoff?',
      'Which errors should never be retried?',
      'How do retries at several layers multiply load?',
    ],
  },
  {
    slug: 'circuit-breaker',
    title: 'Circuit breaker and bulkhead',
    category: 'Reliability',
    level: 'MEDIUM',
    summary: 'Stop calling a failing dependency for a while (closed/open/half-open) and isolate resources so one failure cannot sink everything.',
    prompts: [
      'Describe the three circuit breaker states.',
      'What does a bulkhead isolate?',
      'What should the caller return while the circuit is open?',
    ],
  },
  {
    slug: 'availability-redundancy',
    title: 'Availability, redundancy and failover',
    category: 'Reliability',
    level: 'EASY',
    summary: 'Remove single points of failure with redundant components, health checks and active-active or active-passive failover.',
    prompts: [
      'How much downtime per year is 99.9% vs 99.99%?',
      'Active-active vs active-passive: trade-offs?',
      'How do availabilities combine for components in series and in parallel?',
    ],
  },
  {
    slug: 'graceful-degradation',
    title: 'Graceful degradation and load shedding',
    category: 'Reliability',
    level: 'MEDIUM',
    summary: 'Under overload, drop non-essential work or features so the core path keeps working.',
    prompts: [
      'Give an example of a feature you would turn off first under load.',
      'How do you decide which requests to shed?',
      'Why is shedding load better than queueing it?',
    ],
  },

  // Architecture
  {
    slug: 'monolith-microservices',
    title: 'Monolith vs microservices',
    category: 'Architecture',
    level: 'EASY',
    summary: 'One deployable unit vs many independently deployed services, trading simplicity for team and scaling independence.',
    prompts: [
      'When is a monolith the better choice?',
      'What new problems do microservices introduce?',
      'How do you decide service boundaries?',
    ],
  },
  {
    slug: 'service-discovery',
    title: 'Service discovery',
    category: 'Architecture',
    level: 'MEDIUM',
    summary: 'Services find each other through a registry (client-side or server-side discovery) instead of fixed addresses.',
    prompts: [
      'Client-side vs server-side discovery?',
      'How does a registry learn that an instance died?',
      'What is a service mesh and what does a sidecar do?',
    ],
  },
  {
    slug: 'event-sourcing-cqrs',
    title: 'Event sourcing and CQRS',
    category: 'Architecture',
    level: 'HARD',
    summary: 'Store state as an append-only log of events, and separate the write model from read-optimised projections.',
    prompts: [
      'How do you rebuild current state from events?',
      'Why do CQRS read models lag behind writes?',
      'What is a snapshot and why is it needed?',
    ],
  },
  {
    slug: 'outbox-cdc',
    title: 'Transactional outbox and CDC',
    category: 'Architecture',
    level: 'HARD',
    summary: 'Write the event to an outbox table in the same transaction as the data, then publish it (often via change data capture).',
    prompts: [
      'What dual-write bug does the outbox pattern prevent?',
      'How does change data capture read changes from a database?',
      'How do consumers handle duplicate events from the outbox?',
    ],
  },

  // Observability
  {
    slug: 'metrics-logs-traces',
    title: 'Metrics, logs and traces',
    category: 'Observability',
    level: 'EASY',
    summary: 'Metrics show trends cheaply, logs record events in detail, and distributed traces follow one request across services.',
    prompts: [
      'Which signal would you use first to detect an outage?',
      'How is a trace ID propagated across services?',
      'Why are high-cardinality labels expensive in metrics?',
    ],
  },
  {
    slug: 'sli-slo-sla',
    title: 'SLIs, SLOs, SLAs and error budgets',
    category: 'Observability',
    level: 'MEDIUM',
    summary: 'SLI is what you measure, SLO is the target, SLA is the contract; the error budget is the allowed unreliability.',
    prompts: [
      'Give an SLI and SLO for a checkout API.',
      'How does an error budget change release decisions?',
      'Why should the SLO be stricter than the SLA?',
    ],
  },

  // Case studies
  {
    slug: 'design-url-shortener',
    title: 'Design a URL shortener',
    category: 'Case Study',
    level: 'MEDIUM',
    summary: 'Generate short unique keys, store key → URL mappings, redirect at very high read QPS with caching.',
    prompts: [
      'Base62 counter vs hash: how do you generate keys without collisions?',
      '301 vs 302 redirect: which and why?',
      'How do you scale reads to 100k QPS?',
    ],
  },
  {
    slug: 'design-rate-limiter',
    title: 'Design a distributed rate limiter',
    category: 'Case Study',
    level: 'MEDIUM',
    summary: 'Per-client limits enforced across many servers, usually with a shared counter store like Redis.',
    prompts: [
      'Where does the limiter sit in the request path?',
      'How do you make the counter update atomic in Redis?',
      'What happens if the counter store is down?',
    ],
  },
  {
    slug: 'design-unique-id',
    title: 'Design a unique ID generator',
    category: 'Case Study',
    level: 'MEDIUM',
    summary: 'IDs that are unique across machines and roughly time-sorted, e.g. Snowflake: timestamp + machine ID + sequence.',
    prompts: [
      'Lay out the bits of a Snowflake ID.',
      'What breaks if a machine clock goes backwards?',
      'Why not just use UUIDv4 everywhere?',
    ],
  },
  {
    slug: 'design-news-feed',
    title: 'Design a news feed',
    category: 'Case Study',
    level: 'HARD',
    summary: 'Build each user\'s feed by fan-out on write, fan-out on read, or a hybrid for celebrity accounts.',
    prompts: [
      'Fan-out on write vs on read: trade-offs?',
      'How do you handle a user with 50M followers?',
      'Where do you cache feeds and what do you store?',
    ],
  },
  {
    slug: 'design-chat',
    title: 'Design a chat system',
    category: 'Case Study',
    level: 'HARD',
    summary: 'Real-time 1:1 and group messaging over persistent connections, with delivery receipts, ordering and offline storage.',
    prompts: [
      'How does a message reach a user connected to a different server?',
      'How do you order messages in a group chat?',
      'How do presence (online/offline) updates scale?',
    ],
  },
  {
    slug: 'design-notifications',
    title: 'Design a notification system',
    category: 'Case Study',
    level: 'MEDIUM',
    summary: 'Send push, SMS and email at scale through queues, with templates, user preferences, retries and dedup.',
    prompts: [
      'Why put a queue per channel?',
      'How do you avoid sending the same notification twice?',
      'How do you respect user preferences and quiet hours?',
    ],
  },
  {
    slug: 'design-autocomplete',
    title: 'Design search autocomplete',
    category: 'Case Study',
    level: 'HARD',
    summary: 'Return top suggestions per prefix in milliseconds using tries or precomputed prefix tables built offline.',
    prompts: [
      'How do you store the top-k suggestions per prefix?',
      'How are frequencies updated without slowing reads?',
      'How do you shard a trie?',
    ],
  },
  {
    slug: 'design-web-crawler',
    title: 'Design a web crawler',
    category: 'Case Study',
    level: 'HARD',
    summary: 'A URL frontier with politeness, deduplication of URLs and content, robots.txt, and distributed fetchers.',
    prompts: [
      'How does the frontier enforce per-host politeness?',
      'How do you detect duplicate content?',
      'How do you avoid crawler traps?',
    ],
  },
  {
    slug: 'design-video-streaming',
    title: 'Design video streaming',
    category: 'Case Study',
    level: 'HARD',
    summary: 'Upload, transcode into many bitrates, store segments in blob storage and stream via CDN with adaptive bitrate.',
    prompts: [
      'Why transcode into multiple resolutions and segments?',
      'How does adaptive bitrate (HLS/DASH) work?',
      'Where do most of the costs come from?',
    ],
  },
  {
    slug: 'design-proximity',
    title: 'Design nearby search (ride sharing / maps)',
    category: 'Case Study',
    level: 'HARD',
    summary: 'Find nearby drivers or places using geohashes, quadtrees or S2 cells, with frequent location updates.',
    prompts: [
      'Geohash vs quadtree: trade-offs?',
      'How do you handle a search near a cell boundary?',
      'How do you ingest millions of location updates per minute?',
    ],
  },
];

const BY_SLUG = new Map(CONCEPTS.map((c) => [c.slug, c]));

export function getConcept(slug: string): Concept | undefined {
  return BY_SLUG.get(slug);
}

/** Case-insensitive search over title, category and summary. */
export function searchConcepts(query: string, limit = 8): Concept[] {
  const q = query.trim().toLowerCase();
  if (!q) return CONCEPTS.slice(0, limit);
  const scored = CONCEPTS.map((c) => {
    const title = c.title.toLowerCase();
    let score = 0;
    if (title.startsWith(q)) score = 3;
    else if (title.includes(q)) score = 2;
    else if (c.category.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q)) score = 1;
    return { c, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.c.title.localeCompare(b.c.title));
  return scored.slice(0, limit).map((x) => x.c);
}

/** Notes text stored with a concept: the user's own notes, then the recall prompts. */
export function buildConceptNotes(userNotes: string, concept?: Concept): string {
  const parts: string[] = [];
  if (userNotes.trim()) parts.push(userNotes.trim());
  if (concept) {
    parts.push(`${concept.summary}`);
    parts.push(['Recall before rating:', ...concept.prompts.map((p, i) => `${i + 1}. ${p}`)].join('\n'));
  }
  return parts.join('\n\n');
}
