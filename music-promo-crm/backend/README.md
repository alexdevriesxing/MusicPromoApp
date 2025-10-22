# Music Promo CRM - Backend

This is the backend service for the Music Promo CRM application, built with Node.js, Express, TypeScript, and MongoDB.

## Features

- User authentication (JWT)
- RESTful API endpoints
- MongoDB database integration
- API documentation with Swagger
- TypeScript support
- Environment configuration
- Error handling
- Request validation

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd music-promo-crm/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory and add the following variables:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/music-promo-crm
   
   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=30d
   
   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application
- `npm start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## API Documentation

Once the server is running, you can access the API documentation at:
- Swagger UI: http://localhost:5000/api-docs
- API JSON: http://localhost:5000/api-docs.json

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── app.ts          # Express application
│   └── server.ts       # Server entry point
├── .env                # Environment variables
├── .eslintrc.js        # ESLint configuration
├── .gitignore          # Git ignore file
├── package.json        # Project dependencies and scripts
├── README.md           # Project documentation
├── tsconfig.json       # TypeScript configuration
└── jest.config.js      # Jest configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
