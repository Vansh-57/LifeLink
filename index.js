// index.js

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import csrf from 'csurf';
import validator from 'validator';
import nodemailer from 'nodemailer';
import pgSession from 'connect-pg-simple';

dotenv.config();

const { Pool } = pg;

// Database connection - works for both local and Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false
});

// Test database connection and fix schema
pool.query('SELECT NOW()')
  .then(async () => {
    console.log('✅ Database connected successfully');
    
    // Fix table schema - recreate with correct VARCHAR types
    try {
      await pool.query(`
        DROP TABLE IF EXISTS users CASCADE;
        
        CREATE TABLE users (
          user_id SERIAL PRIMARY KEY,
          full_name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          blood_type VARCHAR(10) NOT NULL,
          phone VARCHAR(20),
          city VARCHAR(100) NOT NULL,
          is_admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Users table created with correct schema');
      
      // Recreate sessions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        );
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON user_sessions (expire);
      `);
      console.log('✅ Sessions table verified');
    } catch (err) {
      console.error('❌ Schema creation error:', err.message);
    }
  })
  .catch(err => { 
      console.error('❌ Database connection error:', err.message); 
      process.exit(1); 
  });

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

export { pool, transporter };

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Middleware: Check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// Middleware: Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

// Middleware Setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions using Postgres
const PgStore = pgSession(session);
app.use(session({
  store: new PgStore({ pool, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// CSRF Protection
app.use(csrf());

// Static files & views
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Nagpur areas (stored in the "city" column)
const nagpurAreas = [
  "Abhyankar Nagar", "Ajni", "Ambazari Layout", "Anant Nagar", "Anjuman Engineering College Complex",
  "Ashok Nagar", "Ayodhya Nagar", "Baba Farid Nagar", "Bagadganj", "Bajaj Nagar", "Bela", "Bezanbagh",
  "Bhandewadi", "Borgaon Road", "Bori (Nagpur)", "Borkhedi", "Byramji Town", "Chaoni", "Chhaoni", "Chinchbhuvan",
  "Civil Lines", "Congress Nagar (Nagpur)", "Dattawadi", "Dawlameti", "Deer Park", "Dhamna", "Dhantoli", "Dharampeth",
  "Dighori Naka", "Dinshaws", "Dongargaon", "Dr. Ambedkar Marg", "Friends Colony", "Gaddi Godam", "Gandhibagh",
  "Gandhinagar", "Ganjipeth", "Ganesh Peth Colony", "Gitti Khadan", "Giripeth", "Gokulpeth", "Gondkhairi", "Gorewada Road",
  "Hanuman Nagar", "Hingna", "Imamwada", "Indora", "Itwari", "Jaitala", "Jaripatka", "Jafar Nagar", "Kapil Nagar",
  "Khamla", "Khapri", "Lakadganj", "Laxmi Nagar", "Mahal", "Manewada", "Manish Nagar", "Mankapur", "Mangalwari",
  "Mankapur", "Maskasath", "Mhalgi Nagar", "Mihan", "Mominpura", "Mouda", "Nandanvan", "Narendra Nagar", "Nari",
  "Nayapura", "Nehru Nagar", "New Indora", "Omkar Nagar", "Pachpaoli", "Pande Layout", "Pardi", "Pawan Bhumi",
  "Pipla", "Police Line Takli", "Pratap Nagar", "Rahiwasi Nagar", "Rahate Colony", "Ramdaspeth", "Ram Nagar",
  "Ravi Nagar", "Sadar", "Sakkardara", "Saraswati Nagar", "Saroj Nagar", "Satranjipura", "Seminary Hills",
  "Shankar Nagar", "Shraddhanand Peth", "Sitabuldi", "Somalwada", "Subhash Nagar", "Surendranagar", "Trimurti Nagar",
  "Untkhana", "Vayusena Nagar", "Wardha Road", "Wardhaman Nagar", "Wathoda", "Wanjari Nagar", "Wathoda Layout",
  "Yashodhara Nagar"
];

// Routes
// Home route - redirect to login if not authenticated
app.get(['/', '/index'], (req, res) => {
  if (req.session.userId) {
    res.render('index', {
      title: 'Home',
      currentYear: new Date().getFullYear(),
      csrfToken: req.csrfToken()
    });
  } else {
    res.redirect('/login');
  }
});

// Register page
app.get('/register', (req, res) => {
  res.render('register', {
    title: 'Register',
    csrfToken: req.csrfToken(),
    bloodTypes: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    nagpurAreas,
    currentYear: new Date().getFullYear()
  });
});

// Register API endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { full_name, email, password, confirmPassword, blood_type, phone, city, terms } = req.body;
    const errors = {};
    if (!full_name || full_name.trim().length < 2) errors.full_name = 'Full name must be at least 2 characters.';
    if (!email || !validator.isEmail(email)) errors.email = 'Invalid email.';
    if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (!blood_type) errors.blood_type = 'Blood type required.';
    if (!city) errors.city = 'City required.';
    else if (!nagpurAreas.includes(city)) errors.city = 'Select valid Nagpur area.';
    if (!terms) errors.terms = 'You must agree to terms.';
    if (Object.keys(errors).length) return res.status(400).json({ errors });
    
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(400).json({ errors: { email: 'Email already registered.' } });
    
    const password_hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, blood_type, phone, city)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [full_name, email, password_hash, blood_type, phone || null, city]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: { general: 'Server error.' } });
  }
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'Login',
    csrfToken: req.csrfToken(),
    currentYear: new Date().getFullYear()
  });
});

// Login API endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ errors: { general: 'Email and password required.' } });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(400).json({ errors: { email: 'Email not registered.' } });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ errors: { password: 'Incorrect password.' } });
    req.session.userId = user.user_id;
    req.session.userEmail = user.email;
    req.session.isAdmin = user.is_admin || false;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: { general: 'Internal server error.' } });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.redirect('/login');
  });
});

// Find Donor page
app.get('/find-donor', requireAuth, async (req, res) => {
  try {
    const { 'blood-type': bt, city, error } = req.query;
    let query = 'SELECT * FROM users';
    const cond = [], vals = [];
    if (bt) { cond.push(`blood_type = $${vals.length + 1}`); vals.push(bt); }
    if (city) { cond.push(`city = $${vals.length + 1}`); vals.push(city); }
    if (cond.length) query += ' WHERE ' + cond.join(' AND ');
    query += ' ORDER BY created_at DESC';
    const donors = (await pool.query(query, vals)).rows;
    res.render('find-donor', {
      title: 'Find Donor',
      donors,
      currentUserId: req.session.userId || null,
      currentUserEmail: req.session.userEmail || null,
      isAdmin: req.session.isAdmin || false,
      csrfToken: req.csrfToken(),
      bloodTypes: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      nagpurAreas,
      currentYear: new Date().getFullYear(),
      error
    });
  } catch (err) {
    console.error(err);
    res.render('find-donor', {
      title: 'Find Donor',
      donors: [],
      currentUserId: req.session.userId || null,
      currentUserEmail: req.session.userEmail || null,
      isAdmin: req.session.isAdmin || false,
      csrfToken: req.csrfToken(),
      bloodTypes: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      nagpurAreas,
      currentYear: new Date().getFullYear(),
      error: 'Server error.'
    });
  }
});

// Delete Donor endpoint - admin can delete anyone, users can only delete themselves
app.post('/api/delete-donor/:donorId', requireAuth, async (req, res) => {
  try {
    const { donorId } = req.params;
    const userEmail = req.session.userEmail;
    const isAdmin = req.session.isAdmin || false;
    
    // Check if the donor exists
    const result = await pool.query('SELECT email FROM users WHERE user_id = $1', [donorId]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Donor not found.' });
    }
    
    // If not admin, can only delete own account
    if (!isAdmin && result.rows[0].email !== userEmail) {
      return res.status(403).json({ error: 'You can only delete your own account.' });
    }
    
    // Delete the donor
    await pool.query('DELETE FROM users WHERE user_id = $1', [donorId]);
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// GET request-donation page
app.get('/request-donation', requireAuth, async (req, res) => {
  const donorId = req.query.donorId;
  if (!donorId) return res.redirect('/find-donor?error=Please+select+a+donor');
  try {
    const { rows } = await pool.query('SELECT user_id, full_name, email FROM users WHERE user_id = $1', [donorId]);
    if (!rows.length) return res.redirect('/find-donor?error=Donor+not+found');
    res.render('req-donation', {
      title: 'Request Donation',
      donor: rows[0],
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error(err);
    res.redirect('/find-donor?error=Server+error');
  }
});

// POST submit-request (Donation Request API)
app.post('/submit-request', async (req, res) => {
  const {
    donorId,
    patientName,
    patientAge,
    bloodType,
    unitsNeeded,
    hospital,
    hospitalAddress,
    requesterName,
    requesterPhone,
    requesterEmail,
    urgency,
    neededBy,
    medicalCondition,
    additionalInfo
  } = req.body;
  if (!donorId) return res.status(400).json({ error: 'Donor not specified.' });
  try {
    const { rows } = await pool.query('SELECT full_name, email FROM users WHERE user_id = $1', [donorId]);
    if (!rows.length) return res.status(404).json({ error: 'Donor not found.' });
    const donor = rows[0];
    const mailOptions = {
      from: `"LifeLink" <${process.env.EMAIL_USER}>`,
      to: donor.email,
      subject: `Blood Request for ${patientName}`,
      text:
        `Hello ${donor.full_name},\n\n` +
        `You have a blood donation request:\n` +
        `Patient: ${patientName}, Age ${patientAge}\n` +
        `Blood Type: ${bloodType}, Units: ${unitsNeeded}\n` +
        `Hospital: ${hospital}, ${hospitalAddress}\n\n` +
        `Requester: ${requesterName}\n` +
        `Phone: ${requesterPhone}\n` +
        `Email: ${requesterEmail || 'N/A'}\n` +
        `Urgency: ${urgency}\n` +
        `Needed By: ${neededBy || 'N/A'}\n` +
        `Condition: ${medicalCondition || 'N/A'}\n` +
        `Additional Info: ${additionalInfo || 'None'}\n\n` +
        `Thank you,\nLifeLink`
    };
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// Other view routes: About, Terms, Privacy
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About',
    currentYear: new Date().getFullYear(),
    csrfToken: req.csrfToken()
  });
});
app.get('/terms', (req, res) => {
  res.render('terms', {
    title: 'Terms of Service',
    currentYear: new Date().getFullYear(),
    csrfToken: req.csrfToken()
  });
});
app.get('/privacy', (req, res) => {
  res.render('privacy', {
    title: 'Privacy Policy',
    currentYear: new Date().getFullYear(),
    csrfToken: req.csrfToken()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    currentYear: new Date().getFullYear(),
    csrfToken: req.csrfToken()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).render('500', {
    title: 'Server Error',
    currentYear: new Date().getFullYear(),
    message: err.message,
    csrfToken: req.csrfToken()
  });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// TEMPORARY: Create admin user on server start
(async function createAdminIfNeeded() {
  try {
    const checkResult = await pool.query(
      'SELECT user_id, email, is_admin FROM users WHERE email = $1',
      ['vanshbargat@gmail.com']
    );

    if (checkResult.rows.length > 0) {
      if (!checkResult.rows[0].is_admin) {
        await pool.query(
          'UPDATE users SET is_admin = TRUE WHERE email = $1',
          ['vanshbargat@gmail.com']
        );
        console.log('✅ Updated vanshbargat@gmail.com to admin!');
      } else {
        console.log('✅ Admin user already exists');
      }
    } else {
      await pool.query(
        `INSERT INTO users (full_name, email, password_hash, blood_type, city, phone, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
      console.log('✅ Admin user created: vanshbargat@gmail.com / adminvansh');
    }
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  }
})();