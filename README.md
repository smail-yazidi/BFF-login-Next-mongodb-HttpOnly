# BFF Authentication System

A secure, production-ready authentication system built with Next.js 13+, MongoDB, and TypeScript. Features include user registration, login, profile management, session handling, rate limiting, and comprehensive security measures.

## Features

### 🔐 **Security First**
- **HttpOnly Cookies** for secure session management
- **bcrypt Password Hashing** with configurable salt rounds
- **Rate Limiting** to prevent brute force attacks
- **Account Lockout** after failed login attempts
- **Session Management** with automatic cleanup
- **Input Validation** using Zod schemas
- **CSRF Protection** built-in

### 🚀 **Authentication Features**
- User Registration with email validation
- Secure Login/Logout
- "Remember Me" functionality
- Password strength requirements
- Account lockout protection
- Session-based authentication

### 👤 **User Management**
- Profile management (name, preferences)
- Password change functionality
- Account deletion with confirmation
- User preferences (theme, notifications)
- Email verification ready

### 🛡️ **Enterprise Security**
- Rate limiting (login: 10/15min, register: 5/hour)
- Account lockout (5 failed attempts = 30min lockout)
- Session expiry (24h default, 30 days with remember me)
- Comprehensive error handling
- Security event logging

## Tech Stack

- **Framework**: Next.js 13+ (App Router)
- **Database**: MongoDB with native driver
- **Authentication**: Custom session-based auth
- **Validation**: Zod
- **Password**: bcrypt
- **Styling**: Tailwind CSS
- **TypeScript**: Full type safety

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/smail-yazidi/BFF-login-Next-mongodb-HttpOnly.git
   cd BFF-login-Next-mongodb-HttpOnly
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=mydb
   NODE_ENV=development
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   SESSION_SECRET=your-super-secret-session-key-change-this
   ```

4. **Start MongoDB**
   ```bash
   # Local MongoDB
   mongod
   
   # Or use MongoDB Atlas (update MONGODB_URI accordingly)
   ```

5. **Run the application**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── login/route.ts          # Login endpoint
│   │   ├── register/route.ts       # Registration endpoint
│   │   └── profile/route.ts        # Profile management
│   ├── login/page.tsx              # Login page
│   ├── register/page.tsx           # Registration page
│   └── layout.tsx                  # Root layout
├── lib/
│   ├── mongodb.ts                  # MongoDB connection
│   └── rate-limit.ts               # Rate limiting utility
├── components/                     # Reusable components
├── .env.example                    # Environment variables template
└── README.md
```

## API Endpoints

### Authentication Endpoints

#### `POST /api/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "Registration successful!",
  "userId": "64a1b2c3d4e5f6789012345",
  "code": "REGISTRATION_SUCCESS"
}
```

#### `POST /api/login`
Authenticate user and create session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "rememberMe": false
}
```

**Response:**
```json
{
  "message": "Login successful",
  "code": "LOGIN_SUCCESS",
  "user": {
    "id": "64a1b2c3d4e5f6789012345",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true
  }
}
```

### Profile Management

#### `GET /api/profile`
Get current user profile (requires authentication).

#### `PATCH /api/profile`
Update user profile.

**Request Body:**
```json
{
  "name": "John Doe",
  "currentPassword": "oldpass",
  "newPassword": "newpass123!",
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}
```

#### `DELETE /api/profile`
Delete user account (requires password confirmation).

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` | Yes |
| `MONGODB_DB_NAME` | Database name | `mydb` | Yes |
| `NODE_ENV` | Environment | `development` | Yes |
| `NEXT_PUBLIC_APP_URL` | Application URL | `http://localhost:3000` | Yes |
| `SESSION_SECRET` | Session encryption key | - | Yes |
| `BCRYPT_SALT_ROUNDS` | Password hashing rounds | `12` | No |
| `MAX_LOGIN_ATTEMPTS` | Max failed logins | `5` | No |
| `ACCOUNT_LOCKOUT_DURATION` | Lockout duration (ms) | `1800000` | No |

See `.env.example` for complete configuration options.

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Rate Limiting
- **Login**: 10 attempts per 15 minutes per IP
- **Registration**: 5 attempts per hour per IP
- **Account Lockout**: 5 failed attempts = 30 minutes lockout

### Session Security
- HttpOnly cookies (XSS protection)
- Secure cookies in production
- SameSite protection (CSRF)
- Automatic session cleanup
- Session invalidation on password change

## Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  email: String (unique, indexed),
  password: String (bcrypt hashed),
  name: String,
  emailVerified: Boolean,
  createdAt: Date,
  updatedAt: Date,
  lastLogin: Date,
  loginAttempts: Number,
  lockUntil: Date,
  preferences: {
    notifications: Boolean,
    theme: String
  }
}
```

### Sessions Collection
```javascript
{
  _id: ObjectId,
  token: String (unique, indexed),
  userId: ObjectId (indexed),
  createdAt: Date,
  expiresAt: Date (indexed, TTL),
  userAgent: String,
  ip: String,
  rememberMe: Boolean
}
```

## Development

### Running Tests
```bash
npm test
# or
yarn test
```

### Type Checking
```bash
npm run type-check
# or
yarn type-check
```

### Building for Production
```bash
npm run build
npm start
# or
yarn build
yarn start
```

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup for Production
- Set `NODE_ENV=production`
- Use strong `SESSION_SECRET`
- Configure MongoDB Atlas for cloud database
- Set up SMTP for email verification
- Configure rate limiting based on your needs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Considerations

- Always use HTTPS in production
- Regularly update dependencies
- Monitor failed login attempts
- Implement proper logging and monitoring
- Consider implementing 2FA for enhanced security
- Regular security audits recommended

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on GitHub or contact the maintainer.

---

**Built with ❤️ for secure authentication needs**