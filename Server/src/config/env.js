import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),

  
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  
  REDIS_URL: z.string().default(''),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars').default('dev-access-secret-change-in-production-please-32chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars').default('dev-refresh-secret-change-in-production-please-32chars'),

  
  GEMINI_API_KEY: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

  // Frontend URL (CORS)
  FRONTEND_URL: z.string(),
  
  ADMIN_EMAILS: z.string(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.format();
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(errors, null, 2));
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
