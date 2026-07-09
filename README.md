# Saraha App Backend

A Node.js and Express backend inspired by the Saraha idea, where users can create accounts, secure them with OTP-based flows, and manage authentication with MongoDB and Redis.

This project currently focuses on:

- User registration with email confirmation OTP
- Sign in with optional two-factor verification
- Password reset with OTP
- JWT-based authentication
- Google sign-in
- File uploads for user attachments/profile image
- Redis support for OTP storage and token revocation

## Tech Stack

- Node.js
- Express
- MongoDB with Mongoose
- Redis
- JWT
- Nodemailer
- Joi
- Multer

## Features

- Register a new user
- Confirm email with a 6-digit OTP
- Resend confirmation OTP
- Login with email and password
- Optional 2FA login confirmation by OTP
- Enable 2FA for an authenticated user
- Reset password through email OTP
- Logout with token revocation stored in Redis
- Google login using `idToken`
- Upload user attachments/images

## Project Structure

```text
src/
  DB/
    models/
    redis/
  enum/
  middleware/
  modules/
    message/
    users/
  utils/
main.js
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/CrowOfJudgement/Sar7a-app.git
cd Sar7a-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a `.env` file

Add the following environment variables:

```env
JWT_SECRET=your_jwt_secret
EMAIL=your_email@example.com
EMAIL_PASSWORD=your_email_app_password
GOOGLE_CLIENT_ID=your_google_client_id
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## Local Services

Before starting the app, make sure these services are running:

- MongoDB on `mongodb://127.0.0.1:27017/saraha-app_db`
- Redis using the host/port configured in `.env`

## Run the App

Development mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm start
```

The server runs on:

```text
http://localhost:3000
```

## API Overview

### Base route

- `GET /` - Welcome route

### User routes

- `POST /users/signup` - Create account
- `POST /users/confirm-email` - Confirm email with OTP
- `POST /users/resend-confirmation-otp` - Resend confirmation OTP
- `POST /signIn` - Start login
- `POST /signIn/confirm` - Confirm login OTP when 2FA is enabled
- `POST /signIn/resend-otp` - Resend login OTP
- `GET /profile` - Get current user profile
- `POST /users/2fa/enable` - Start enabling 2FA
- `POST /users/2fa/verify` - Verify 2FA setup OTP
- `POST /users/2fa/resend-otp` - Resend 2FA setup OTP
- `PATCH /users/password` - Change password
- `POST /users/password/forgot` - Request password reset OTP
- `POST /users/password/resend-otp` - Resend password reset OTP
- `POST /users/password/reset` - Reset password
- `POST /logout` - Logout and revoke JWT
- `POST /loginWithGmail` - Login with Google

### Authentication

Protected routes require this header:

```http
Authorization: Bearer <your_token>
```

## Request Notes

- Signup accepts uploaded files in the `attachments` field.
- OTPs are 6 digits and are time-limited.
- Unconfirmed users are automatically removed after 24 hours by a MongoDB TTL index.
- JWT tokens expire after 24 hours.

## Important Note

There is a `message` module in the codebase for anonymous messages, but it is not currently mounted in the main Express app, so its routes are not active yet.

## Future Improvements

- Add route documentation with Postman or Swagger
- Mount and complete the message module
- Add tests
- Move MongoDB connection string to `.env`
- Add rate limiting and stronger production validation

## Author

Built by the repository owner of [Sar7a-app](https://github.com/CrowOfJudgement/Sar7a-app).
