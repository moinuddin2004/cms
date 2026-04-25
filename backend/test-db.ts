import { DataSource } from 'typeorm';

const ds = new DataSource({
  type: 'postgres',
  url: 'postgresql://neondb_owner:npg_u1QZ4nJzGcyr@ep-cold-hat-a1m4o76w-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require', // This is from .env usually, but let's just get it. Let me check the process env using another script or read .env.
});
