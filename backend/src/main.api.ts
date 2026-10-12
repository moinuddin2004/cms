import { bootstrapHttp } from './bootstrap/http';

// API instance: HTTP + Socket.IO gateway. Realtime events arrive from the
// worker over Redis (REDIS_URL); no background jobs run here. Run 2+ behind
// a load balancer, each with its own PORT.
bootstrapHttp('api');
