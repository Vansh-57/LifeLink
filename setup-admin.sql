-- Admin Setup for LifeLink Blood Donation System
-- This script creates an admin user account

-- Create admin user
-- Email: vanshbargat@gmail.com
-- Password: adminvansh (hashed with bcrypt)

INSERT INTO users (full_name, email, password_hash, blood_type, city, phone, is_admin)
VALUES (
  'Admin Vansh',
  'vanshbargat@gmail.com',
  '$2a$12$aNO/5RVD0v4eIpFXVIEbOOzPkUzlECvCh4l4q0xBLJZVZUqEsVQnS',
  'O+',
  'Nagpur',
  '9999999999',
  TRUE
)
ON CONFLICT (email) 
DO UPDATE SET is_admin = TRUE;

-- Verify the admin user was created
SELECT user_id, full_name, email, is_admin, created_at 
FROM users 
WHERE email = 'vanshbargat@gmail.com';