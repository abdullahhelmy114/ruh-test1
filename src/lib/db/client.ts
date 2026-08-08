import { neon, neonConfig } from '@neondatabase/serverless';

// neonConfig.fetchConnectionCache = true;  <-- تم إيقاف هذا السطر لأنه أصبح قديماً ويعمل تلقائياً

const sql = neon(process.env.DATABASE_URL!);

export { sql };