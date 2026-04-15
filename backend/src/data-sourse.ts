import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './user/entities/user.model';
import { Patient } from './patients/entities/patient.entity';
import { UserSession } from './session/entities/user-session.entity';
import { SecurityLog } from './auth/entities/SecurityLog';

// Load environment variables
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: true,
  entities: [
    User,
    Patient,
    UserSession,
    SecurityLog,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});

