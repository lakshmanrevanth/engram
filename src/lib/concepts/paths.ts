// Learning paths, in reading order, from Vidya (https://www.vidya-bodha.com/paths)
// by @Harry_The_Nerd. Only titles, one-line summaries and links are kept here;
// every article is read on the original site.
//
// Each article can be marked as learned in order. Marking one creates a
// SYSTEM_DESIGN concept (code "path:<id>") that follows the review ladder.

export type PathArticleKind = 'hld' | 'lld' | 'concept';

export type PathArticle = {
  id: string; // "<path slug>-<position>", stable
  position: number; // 1-based order within the path
  title: string;
  summary: string;
  url: string;
  kind: PathArticleKind;
};

export type LearningPath = {
  slug: string;
  title: string;
  description: string;
  level: 'EASY' | 'MEDIUM' | 'HARD';
  levelLabel: 'Beginner' | 'Intermediate' | 'Advanced';
  articles: PathArticle[];
};

export const PATHS_SOURCE = {
  name: 'Vidya',
  url: 'https://www.vidya-bodha.com/paths',
  author: '@Harry_The_Nerd',
};

export const LEARNING_PATHS: LearningPath[] = [
  {
    slug: "system-design-fundamentals",
    title: "System Design Fundamentals",
    description: "The building blocks every large system is made of. Start here if HLD feels overwhelming.",
    level: "EASY",
    levelLabel: "Beginner",
    articles: [
      { id: "system-design-fundamentals-1", position: 1, title: "System Design for Beginners: How to Start With HLD and LLD", summary: "System design fundamentals for beginners", url: "https://x.com/Harry_The_Nerd/status/2099048223797043656", kind: "concept" },
      { id: "system-design-fundamentals-2", position: 2, title: "Design a Load Balancer", summary: "How load balancers work and how to design one from scratch.", url: "https://x.com/Harry_The_Nerd/status/2046465659551576395", kind: "hld" },
      { id: "system-design-fundamentals-3", position: 3, title: "Design a Content Delivery Network", summary: "CDN architecture, caching strategies, and edge delivery.", url: "https://x.com/Harry_The_Nerd/status/2046578404758295032", kind: "hld" },
      { id: "system-design-fundamentals-4", position: 4, title: "Design Consistent Hashing", summary: "How consistent hashing works and where it's used.", url: "https://x.com/Harry_The_Nerd/status/2057098732328648808", kind: "hld" },
      { id: "system-design-fundamentals-5", position: 5, title: "Design A Unique ID Generator in Distributed Systems", summary: "Designing a distributed unique ID generator (e.g. Snowflake-style).", url: "https://x.com/Harry_The_Nerd/status/2057461354114728238", kind: "hld" },
      { id: "system-design-fundamentals-6", position: 6, title: "Design A Distributed Cache", summary: "Architecture of a distributed caching layer.", url: "https://x.com/Harry_The_Nerd/status/2048052028174463278", kind: "hld" },
      { id: "system-design-fundamentals-7", position: 7, title: "A Complete Guide to Redis", summary: "In-depth guide covering Redis internals and use cases.", url: "https://www.vidya-bodha.com/articles/a-complete-guide-to-redis", kind: "concept" },
      { id: "system-design-fundamentals-8", position: 8, title: "Design a Distributed Key-Value store", summary: "Designing a distributed key-value store with partitioning and replication.", url: "https://x.com/Harry_The_Nerd/status/2047329176982827353", kind: "hld" },
      { id: "system-design-fundamentals-9", position: 9, title: "Design A Rate Limiter", summary: "Algorithms and architecture for rate limiting at scale.", url: "https://x.com/Harry_The_Nerd/status/2045533839649624096", kind: "hld" },
      { id: "system-design-fundamentals-10", position: 10, title: "Apache Kafka: Crash Course", summary: "Crash course covering Apache Kafka fundamentals.", url: "https://x.com/Harry_The_Nerd/status/2062165677033820383", kind: "concept" },
      { id: "system-design-fundamentals-11", position: 11, title: "Design A Distributed Message Queue", summary: "System design for a distributed message queue and streaming service like Kafka", url: "https://x.com/Harry_The_Nerd/status/2106418481130516785", kind: "hld" },
      { id: "system-design-fundamentals-12", position: 12, title: "Design an Authentication System", summary: "Designing a scalable authentication and session management system.", url: "https://x.com/Harry_The_Nerd/status/2048758919770816850", kind: "hld" },
      { id: "system-design-fundamentals-13", position: 13, title: "Design A Notification System", summary: "System design for a scalable multi-channel notification system.", url: "https://x.com/Harry_The_Nerd/status/2044839667267494292", kind: "hld" },
    ],
  },
  {
    slug: "hld-interview-prep",
    title: "HLD Interview Prep",
    description: "Classic product design questions, ordered from warm-up to the ones that come up in senior loops.",
    level: "MEDIUM",
    levelLabel: "Intermediate",
    articles: [
      { id: "hld-interview-prep-1", position: 1, title: "Tricky HLD Patterns for interviews", summary: "Commonly missed high-level design patterns for interviews.", url: "https://x.com/Harry_The_Nerd/status/2056739488114856226", kind: "hld" },
      { id: "hld-interview-prep-2", position: 2, title: "Design Bit.ly and Pastebin", summary: "Walkthrough of designing URL shorteners and paste-sharing services.", url: "https://www.vidya-bodha.com/articles/design-bit-ly-and-pastebin", kind: "hld" },
      { id: "hld-interview-prep-3", position: 3, title: "Design Autocomplete For Search Engines", summary: "Designing a low-latency autocomplete/typeahead system.", url: "https://x.com/Harry_The_Nerd/status/2045906641967833171", kind: "hld" },
      { id: "hld-interview-prep-4", position: 4, title: "Design A News-Feed System", summary: "System design for a scalable news feed.", url: "https://x.com/Harry_The_Nerd/status/2058553384735842654", kind: "hld" },
      { id: "hld-interview-prep-5", position: 5, title: "Design A Chat System", summary: "System design for a real-time chat application.", url: "https://x.com/Harry_The_Nerd/status/2061445321910284589", kind: "hld" },
      { id: "hld-interview-prep-6", position: 6, title: "Design Twitter", summary: "System design for a microblogging platform like Twitter.", url: "https://x.com/Harry_The_Nerd/status/2068309801638195531", kind: "hld" },
      { id: "hld-interview-prep-7", position: 7, title: "Design Instagram", summary: "System design for a photo/video sharing platform like Instagram.", url: "https://x.com/Harry_The_Nerd/status/2065074213665579192", kind: "hld" },
      { id: "hld-interview-prep-8", position: 8, title: "Design Reddit", summary: "System design for a forum/link-aggregation platform like Reddit.", url: "https://x.com/Harry_The_Nerd/status/2067615247259811850", kind: "hld" },
      { id: "hld-interview-prep-9", position: 9, title: "Design Tinder", summary: "System design for a location-based matching app like Tinder.", url: "https://x.com/Harry_The_Nerd/status/2065790968448909572", kind: "hld" },
      { id: "hld-interview-prep-10", position: 10, title: "System Design Of A Proximity Service", summary: "Designing a proximity service for discovering nearby apps", url: "https://x.com/Harry_The_Nerd/status/2091192716059459825", kind: "concept" },
      { id: "hld-interview-prep-11", position: 11, title: "Design Youtube", summary: "High-level design walkthrough for a YouTube-like system.", url: "https://x.com/Harry_The_Nerd/status/2062909779576791167", kind: "hld" },
      { id: "hld-interview-prep-12", position: 12, title: "Design Spotify", summary: "System design for a music streaming platform like Spotify.", url: "https://x.com/Harry_The_Nerd/status/2063952850531897396", kind: "hld" },
      { id: "hld-interview-prep-13", position: 13, title: "Design Netflix", summary: "System design for a video streaming platform like Netflix.", url: "https://x.com/Harry_The_Nerd/status/2071256571028648283", kind: "hld" },
      { id: "hld-interview-prep-14", position: 14, title: "Design Medium", summary: "System design for an open publishing and social journalism platform like Medium", url: "https://x.com/Harry_The_Nerd/status/2084263186199638124", kind: "hld" },
      { id: "hld-interview-prep-15", position: 15, title: "Design Leetcode", summary: "System design for a programming platform like Leetcode", url: "https://x.com/Harry_The_Nerd/status/2083591314067927258", kind: "hld" },
      { id: "hld-interview-prep-16", position: 16, title: "Design Amazon", summary: "System design for an e-commerce platform like Amazon.", url: "https://x.com/Harry_The_Nerd/status/2070543086258979132", kind: "hld" },
      { id: "hld-interview-prep-17", position: 17, title: "Design Airbnb", summary: "System design for a hotel-booking platform like Airbnb.", url: "https://x.com/Harry_The_Nerd/status/2079561027788611975", kind: "hld" },
      { id: "hld-interview-prep-18", position: 18, title: "Design Google Drive", summary: "System design of a cloud storage service like Google Drive", url: "https://x.com/Harry_The_Nerd/status/2088619948113641872", kind: "hld" },
      { id: "hld-interview-prep-19", position: 19, title: "Design Google Docs", summary: "System design for a real-time collaborative platform like Google Docs", url: "https://x.com/Harry_The_Nerd/status/2087149020011774260", kind: "hld" },
      { id: "hld-interview-prep-20", position: 20, title: "Design Google Maps", summary: "System design for a mapping and navigation platform like Google Maps", url: "https://x.com/Harry_The_Nerd/status/2101675662482571673", kind: "hld" },
      { id: "hld-interview-prep-21", position: 21, title: "Design Discord", summary: "System design for a discord-like platform", url: "https://x.com/Harry_The_Nerd/status/2114362276316942758", kind: "hld" },
      { id: "hld-interview-prep-22", position: 22, title: "Design A Metrics Monitoring and Alerting System", summary: "System design for a scalable metrics monitoring and alerting System", url: "https://x.com/Harry_The_Nerd/status/2108858835440119870", kind: "hld" },
    ],
  },
  {
    slug: "lld-classics",
    title: "LLD Classics",
    description: "Object oriented design concepts, then the machine coding problems interviewers love.",
    level: "EASY",
    levelLabel: "Beginner",
    articles: [
      { id: "lld-classics-1", position: 1, title: "LLD Concepts", summary: "Core low-level design concepts for interviews and practice.", url: "https://www.vidya-bodha.com/articles/lld-concepts", kind: "lld" },
      { id: "lld-classics-2", position: 2, title: "Design a Parking Lot", summary: "Classic LLD problem: designing a parking lot system.", url: "https://www.vidya-bodha.com/articles/design-a-parking-lot", kind: "lld" },
      { id: "lld-classics-3", position: 3, title: "Design a Vending Machine", summary: "Classic LLD problem: designing a vending machine.", url: "https://www.vidya-bodha.com/articles/design-a-vending-machine", kind: "lld" },
      { id: "lld-classics-4", position: 4, title: "Design a basic Music System", summary: "Low-level design of a basic music streaming/playback system.", url: "https://www.vidya-bodha.com/articles/design-a-basic-music-system", kind: "lld" },
      { id: "lld-classics-5", position: 5, title: "Design Youtube (LLD)", summary: "Low-level design walkthrough for a YouTube-like system.", url: "https://www.vidya-bodha.com/articles/lld-design-youtube", kind: "lld" },
    ],
  },
  {
    slug: "backend-engineering-fundamentals",
    title: "Backend Engineering Fundamentals",
    description: "How a production backend actually works, from the first HTTP request to scaling and security.",
    level: "EASY",
    levelLabel: "Beginner",
    articles: [
      { id: "backend-engineering-fundamentals-1", position: 1, title: "HTTP & Routing", summary: "Core concepts of HTTP and routing in backend systems.", url: "https://x.com/Harry_The_Nerd/status/2053366145995178087", kind: "concept" },
      { id: "backend-engineering-fundamentals-2", position: 2, title: "Serialization, Deserialization, Authentication and Authorization", summary: "Backend fundamentals: serialization, auth, and authz.", url: "https://x.com/Harry_The_Nerd/status/2053487726033559704", kind: "concept" },
      { id: "backend-engineering-fundamentals-3", position: 3, title: "Validation, Transformation, Controllers, Middlewares", summary: "Request handling patterns: validation, transformation, controllers, middleware.", url: "https://x.com/Harry_The_Nerd/status/2053882356071911853", kind: "concept" },
      { id: "backend-engineering-fundamentals-4", position: 4, title: "Rest API Design", summary: "Principles and best practices for designing REST APIs.", url: "https://x.com/Harry_The_Nerd/status/2054882198604628305", kind: "concept" },
      { id: "backend-engineering-fundamentals-5", position: 5, title: "Databases in Depth Part-1", summary: "Part 1 of a deep dive into database internals.", url: "https://x.com/Harry_The_Nerd/status/2073772366094602241", kind: "concept" },
      { id: "backend-engineering-fundamentals-6", position: 6, title: "Databases in Depth Part-2", summary: "Part 2 of a deep dive into database internals.", url: "https://x.com/Harry_The_Nerd/status/2075942037732667812", kind: "concept" },
      { id: "backend-engineering-fundamentals-7", position: 7, title: "Databases in Depth Part-3", summary: "Part 3 of a deep dive into database internals.", url: "https://x.com/Harry_The_Nerd/status/2076649413435687097", kind: "concept" },
      { id: "backend-engineering-fundamentals-8", position: 8, title: "Caching, Task Queues, Error Handling, Logging, Monitoring", summary: "Backend fundamentals: caching, task queues, error handling, logging, monitoring.", url: "https://x.com/Harry_The_Nerd/status/2077400118647750968", kind: "concept" },
      { id: "backend-engineering-fundamentals-9", position: 9, title: "Security, Scaling & Performance, Concurrency & Parallelism", summary: "Backend fundamentals: security, scaling, performance, concurrency.", url: "https://x.com/Harry_The_Nerd/status/2077722979882963122", kind: "concept" },
    ],
  },
  {
    slug: "distributed-systems",
    title: "Distributed Systems",
    description: "A multi part series on time, replication, consistency, consensus, and failure, meant to be read start to finish.",
    level: "HARD",
    levelLabel: "Advanced",
    articles: [
      { id: "distributed-systems-1", position: 1, title: "Distributed Systems Part-1 (Introduction)", summary: "Distributed Systems: Foundations and the Impossibility Results", url: "https://x.com/Harry_The_Nerd/status/2092234002610680246", kind: "concept" },
      { id: "distributed-systems-2", position: 2, title: "Distributed Systems Part-2 (Time, Order, and Causality)", summary: "Distributed Systems: Time, Order, and Causality", url: "https://x.com/Harry_The_Nerd/status/2092969096774287363", kind: "concept" },
      { id: "distributed-systems-3", position: 3, title: "Distributed Systems Part-3 (Replication Strategies)", summary: "Replication Strategies in Distributed Systems", url: "https://x.com/Harry_The_Nerd/status/2093700736299487430", kind: "concept" },
      { id: "distributed-systems-4", position: 4, title: "Distributed Systems Part-4 (Consistency Models)", summary: "Different consistency models in Distributed Systems", url: "https://x.com/Harry_The_Nerd/status/2094422311906726202", kind: "concept" },
      { id: "distributed-systems-5", position: 5, title: "Distributed Systems Part-5 (Consensus Algorithms)", summary: "Consensus Algorithms in Distributed Systems", url: "https://x.com/Harry_The_Nerd/status/2095122732065443969", kind: "concept" },
      { id: "distributed-systems-6", position: 6, title: "Distributed Systems Part-6 (Partitioning and Sharding)", summary: "How to split your data across many nodes so that no single machine has to hold all of it or serve all the traffic for it.", url: "https://x.com/Harry_The_Nerd/status/2095844630399263161", kind: "concept" },
      { id: "distributed-systems-7", position: 7, title: "Distributed Systems Part-7 (Failure Detection and Fault Tolerance)", summary: "Failure detetction and fault tolerance in distributed systems", url: "https://x.com/Harry_The_Nerd/status/2096163179596525852", kind: "concept" },
      { id: "distributed-systems-8", position: 8, title: "Distributed Systems Part-8 (Distributed Transactions Revisited)", summary: "Distributed transactions and case-studies", url: "https://x.com/Harry_The_Nerd/status/2096575304722747738", kind: "concept" },
    ],
  },
  {
    slug: "microservices",
    title: "Microservices",
    description: "When to split a monolith, where to draw boundaries, and how services talk and stay consistent.",
    level: "MEDIUM",
    levelLabel: "Intermediate",
    articles: [
      { id: "microservices-1", position: 1, title: "Mental Model for Microservices", summary: "An introduction to Microservices", url: "https://x.com/Harry_The_Nerd/status/2080261902593065465", kind: "concept" },
      { id: "microservices-2", position: 2, title: "Monolith To Microservices", summary: "From a plain monolith to true microservices", url: "https://x.com/Harry_The_Nerd/status/2080659276998291721", kind: "concept" },
      { id: "microservices-3", position: 3, title: "Service Decomposition And Boundaries", summary: "Decomposition of Services", url: "https://x.com/Harry_The_Nerd/status/2080943768153596085", kind: "concept" },
      { id: "microservices-4", position: 4, title: "Inter-Service Communication", summary: "How services communicate with each other", url: "https://x.com/Harry_The_Nerd/status/2081302031646806047", kind: "concept" },
      { id: "microservices-5", position: 5, title: "Data Ownership And Read Models", summary: "How services handle data when there's no shared database to fall back on", url: "https://x.com/Harry_The_Nerd/status/2081673770092433631", kind: "concept" },
      { id: "microservices-6", position: 6, title: "Distributed Transactions, Sagas, and Consistency", summary: "What happens when a single business operation needs to update data across multiple services, and there's no shared database transaction to fall back on", url: "https://x.com/Harry_The_Nerd/status/2082019622224900154", kind: "concept" },
    ],
  },
  {
    slug: "ai-and-ml-foundations",
    title: "AI and ML Foundations",
    description: "The vocabulary and core ideas behind modern AI, plus a real ML system design.",
    level: "EASY",
    levelLabel: "Beginner",
    articles: [
      { id: "ai-and-ml-foundations-1", position: 1, title: "AI Terminology Explained", summary: "A Complete Beginner's Glossary for AI Terminology", url: "https://x.com/Harry_The_Nerd/status/2087837722098700421", kind: "concept" },
      { id: "ai-and-ml-foundations-2", position: 2, title: "Everything About Machine Learning", summary: "An introduction to Machine Learning", url: "https://x.com/Harry_The_Nerd/status/2086085446300533025", kind: "concept" },
      { id: "ai-and-ml-foundations-3", position: 3, title: "Netflix Recommendation System - Machine Learning System Design", summary: "ML system design breakdown of Netflix's recommendation engine.", url: "https://x.com/Harry_The_Nerd/status/2069785739810705773", kind: "concept" },
    ],
  },
];

const ARTICLES = new Map(
  LEARNING_PATHS.flatMap((p) => p.articles.map((a) => [a.id, { path: p, article: a }] as const))
);

export function getPathArticle(id: string): { path: LearningPath; article: PathArticle } | undefined {
  return ARTICLES.get(id);
}

/** Concept code used to track a path article. */
export const pathCode = (articleId: string) => `path:${articleId}`;

/** The article that must be learned before this one, if any. */
export function previousArticle(id: string): PathArticle | undefined {
  const entry = ARTICLES.get(id);
  if (!entry || entry.article.position === 1) return undefined;
  return entry.path.articles[entry.article.position - 2];
}

/** Questions to answer from memory before rating a review of this article. */
export function promptsFor(article: PathArticle): string[] {
  if (article.kind === 'hld') {
    return [
      'What are the functional and non-functional requirements, and the rough scale?',
      'Sketch the main components and how a request flows through them.',
      'Where is the bottleneck, and how does the design scale past it?',
      'Which trade-offs did the design make (consistency, latency, cost)?',
    ];
  }
  if (article.kind === 'lld') {
    return [
      'What are the core classes/entities and their responsibilities?',
      'Which design patterns or principles does the design rely on, and why?',
      'How would you extend it for a new requirement without rewriting it?',
    ];
  }
  return [
    'Explain the core idea in your own words, in three sentences.',
    'What problem does it solve, and when would you use it?',
    'What are the main trade-offs or failure cases?',
  ];
}
