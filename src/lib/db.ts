import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// 确保有环境变量 DATABASE_URL
if (!process.env.DATABASE_URL) {
  throw new Error('数据库连接URL未设置');
}

// 创建数据库连接
const sql = neon(process.env.DATABASE_URL);
export { sql }; // 导出sql以便其他模块可以使用
export const db = drizzle(sql);

// 初始化数据库函数
export async function initDatabase() {
  try {
    // 创建日志表
    await sql`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('数据库表初始化成功');
  } catch (error) {
    console.error('数据库表初始化失败:', error);
    throw error;
  }
} 