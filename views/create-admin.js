// create-admin.js
// Run this script to create an admin user

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'LIFEdb',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function createAdmin() {
  try {
    console.log('🔄 Connecting to database...');
    
    // Check if user already exists
    const checkResult = await pool.query(
      'SELECT user_id, email, is_admin FROM users WHERE email = $1',
      ['vanshbargat@gmail.com']
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ User already exists!');
      console.log('Current status:', checkResult.rows[0]);
      
      // Update to admin if not already
      if (!checkResult.rows[0].is_admin) {
        await pool.query(
          'UPDATE users SET is_admin = TRUE WHERE email = $1',
          ['vanshbargat@gmail.com']
        );
        console.log('✅ Updated user to admin status!');
      } else {
        console.log('✅ User already has admin privileges!');
      }
    } else {
      // Create new admin user
      const result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, blood_type, city, phone, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING user_id, full_name, email, is_admin`,
        [
          'Admin Vansh',
          'vanshbargat@gmail.com',
          '$2a$12$aNO/5RVD0v4eIpFXVIEbOOzPkUzlECvCh4l4q0xBLJZVZUqEsVQnS',
          'O+',
          'Nagpur',
          '9999999999',
          true
        ]
      );
      
      console.log('✅ Admin user created successfully!');
      console.log('Details:', result.rows[0]);
    }

    console.log('\n📧 Login credentials:');
    console.log('Email: vanshbargat@gmail.com');
    console.log('Password: adminvansh');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createAdmin();