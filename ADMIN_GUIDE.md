# LifeLink Blood Donation - Admin & User Management Guide

## 🔐 Admin Account Setup

### Admin Credentials:
- **Email:** vanshbargat@gmail.com
- **Password:** adminvansh

---

## ✅ Features Implemented

### 1. **Login/Register Page on Website Open**
   - Home route (/) redirects to /login if not authenticated
   - New visitors see login/register immediately
   - Login success redirects to find-donor page

### 2. **Admin Delete Functionality** ⭐ NEW
   - Admin (vanshbargat@gmail.com) can delete ANY donor account
   - Admin can see donor details:
     - Full Name
     - Email ✅ (visible to admin only)
     - Phone ✅ (visible to admin only)
     - Blood Type
     - City
   - Red "Delete Donor Account" button on every donor card
   - Can manage user accounts without restrictions

### 3. **User Delete Functionality**
   - Regular users can ONLY delete their own account
   - Own account marked with ★ star
   - Shows "Delete My Account" button only on their card
   - Cannot delete other users

### 4. **Logout Functionality**
   - `/logout` route clears session
   - Logout button in navbar when logged in
   - Redirects to login

### 5. **Authentication Middleware**
   - `requireAuth` - Protects routes, redirects to login
   - Protected routes: `/find-donor`, `/request-donation`

### 6. **Session Management**
   - Stores: `userId`, `userEmail`, `isAdmin`
   - isAdmin flag determines access level

---

## 🚀 How to Use

### Login as Admin:
1. Visit website → Login page
2. Enter:
   - Email: `vanshbargat@gmail.com`
   - Password: `adminvansh`
3. Click Login → Redirects to find-donor
4. See all donors with:
   - Names
   - Emails
   - Phone numbers
   - Blood types
   - Cities
5. Click "Delete Donor Account" on any donor to remove them
6. Confirmation dialog → Confirm to delete

### Login as Regular User:
1. Visit website → Login page
2. Register OR login with existing account
3. Redirects to find-donor page
4. See all donors
5. Find own account (marked with ★)
6. Can delete only own account
7. Other users' accounts show "Request Donation" only

---

## 🔧 Database Setup

### Step 1: Add Admin Column
```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
```

### Step 2: Create Admin User
Run this SQL:
```sql
INSERT INTO users (full_name, email, password_hash, blood_type, city, phone, is_admin)
VALUES (
  'Admin',
  'vanshbargat@gmail.com',
  '$2a$12$aNO/5RVD0v4eIpFXVIEbOOzPkUzlECvCh4l4q0xBLJZVZUqEsVQnS',
  'O+',
  'Nagpur',
  '9999999999',
  TRUE
);
```

### Step 3: Verify
```sql
SELECT user_id, email, is_admin FROM users WHERE email = 'vanshbargat@gmail.com';
```

Should show:
```
user_id | email                     | is_admin
1       | vanshbargat@gmail.com     | true
```

---

## 📝 Updated Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    blood_type VARCHAR(3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    phone VARCHAR(20),
    city VARCHAR(100),
    is_admin BOOLEAN DEFAULT FALSE
);
```

---

## 🔐 Security Features

✅ Admin verified by email/password
✅ Session-based role verification
✅ Backend validates permissions before deletion
✅ Regular users cannot delete others (backend enforced)
✅ Email uniqueness constraint
✅ Password hashing with bcryptjs
✅ CSRF protection

---

## 📂 Files Modified

- `index.js` - Added admin middleware, delete logic, session variables
- `schema.sql` - Added is_admin column
- `setup-admin.sql` - Admin setup script
- `views/find-donor.ejs` - Admin UI, delete buttons, donor info visibility

---

## 🧪 Test Cases

### Admin Testing:
- [ ] Login with admin credentials
- [ ] See email/phone of all donors
- [ ] Delete button appears on all donors
- [ ] Click delete → Confirmation with donor name
- [ ] Confirm → Donor deleted
- [ ] Donor no longer in list
- [ ] Logout works

### User Testing:
- [ ] Register new account
- [ ] Login with credentials
- [ ] See own account with ★
- [ ] Delete button only on own account
- [ ] Delete my account → Confirmation
- [ ] Account deleted → Redirected to find-donor
- [ ] Try to delete others → 403 error

---

## 📧 Admin Account Details

| Property | Value |
|----------|-------|
| Full Name | Admin |
| Email | vanshbargat@gmail.com |
| Password | adminvansh |
| Blood Type | O+ |
| City | Nagpur |
| Phone | 9999999999 |
| Role | Administrator |
| Can Delete | Any account |
| Can See | All donor details |

---

## 🎯 Workflow Summary

### Admin Workflow:
1. Login (admin credentials)
2. View all donors with full info
3. Click "Delete Donor Account" on any user
4. Confirm deletion
5. User removed from system
6. Logout when done

### User Workflow:
1. Register or Login
2. View all donors
3. Find own account (★)
4. Delete only own account if needed
5. Logout

---

## ⚠️ Important Notes

- Admin account created via SQL (not registration form)
- Cannot become admin through UI
- If admin account deleted, create new one via SQL
- Admin email/password can be changed via SQL UPDATE
- Regular users cannot access admin features
- Session stores admin flag for each login
