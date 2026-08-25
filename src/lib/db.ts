// src/lib/db.ts
import { Pool } from '@neondatabase/serverless';

// إنشاء اتصال مجمّع بقاعدة بيانات Neon
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
};