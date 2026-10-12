import { bootstrapHttp } from './bootstrap/http';

// Single process (dev): HTTP + Socket.IO + outbox relay + jobs, no Redis
// needed for realtime. Production runs main.api (2+) and main.worker (1).
bootstrapHttp('all');
