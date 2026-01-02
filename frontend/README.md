# LMS Frontend

React frontend for the Learning Management System.

## Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure API URL**
   - Default: `http://localhost:8000/api`
   - Can be set via `REACT_APP_API_URL` environment variable

3. **Start development server**
   ```bash
   npm start
   ```

   The app will open at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Project Structure

- `src/components/` - Reusable React components
- `src/contexts/` - React context providers (Auth, etc.)
- `src/pages/` - Page components
- `src/services/` - API service functions

## Features

- Material-UI components for modern UI
- JWT authentication
- Role-based routing
- Responsive design
- Toast notifications

