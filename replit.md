# BioDrive+ - AI-Powered Biometric Optimization Platform

## Overview

BioDrive+ is a full-stack web application that leverages AI to turn wearable device data (WHOOP, Apple Watch) into personalized nutrition, recovery, and performance recommendations. The platform provides users with data-driven insights to optimize their daily routines based on their biometric information.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom design tokens and dark mode support
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **External Services**: OpenAI API for AI-powered recommendations
- **Session Management**: Express sessions with PostgreSQL storage
- **Development**: Hot module replacement with Vite integration

## Key Components

### Data Models
- **Users**: Core user information with subscription tiers (basic, pro, elite)
- **Wearable Data**: Device metrics including sleep score, HRV, strain level, heart rate
- **Meal Plans**: AI-generated nutrition recommendations with macronutrient breakdowns
- **Recovery Protocols**: Personalized recovery strategies (cold therapy, breathwork, supplements)
- **Performance Scores**: Calculated metrics tracking user progress over time

### AI Integration
- **OpenAI GPT-4o**: Powers personalized meal plan, recovery protocol, and 1:1 coaching generation
- **Biometric Analysis**: Processes sleep, strain, and HRV data to create tailored recommendations
- **Contextual Recommendations**: Adjusts suggestions based on subscription tier and historical data
- **AI Personal Coach**: Advanced coaching system providing personalized insights, actionable recommendations, and progress tracking
- **Smart Insights**: AI-powered pattern analysis with predictive analytics and trend forecasting
- **Goal Tracking**: Intelligent goal setting with milestone tracking and progress analytics
- **User Preferences**: Comprehensive preference management for personalized coaching experiences

### Device Integration
- **Wearable Simulation**: Mock data generation for WHOOP and Apple Watch devices
- **Real-time Updates**: Periodic data synchronization with device status monitoring
- **Multi-device Support**: Unified interface for different wearable platforms

## Data Flow

1. **Data Collection**: Wearable devices provide biometric data (sleep, HRV, strain)
2. **AI Processing**: OpenAI API analyzes metrics to generate personalized recommendations
3. **Storage**: Recommendations and metrics stored in PostgreSQL via Drizzle ORM
4. **Presentation**: React frontend displays dashboard with real-time updates
5. **User Interaction**: Users can regenerate recommendations and track progress

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database operations
- **openai**: AI-powered recommendation generation
- **@tanstack/react-query**: Client-side data fetching and caching
- **@radix-ui/react-***: Accessible UI component primitives
- **recharts**: Data visualization for performance metrics

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type safety across frontend and backend
- **Tailwind CSS**: Utility-first styling framework
- **ESBuild**: Fast JavaScript bundling for production

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express API integration
- **Hot Reload**: Full-stack hot module replacement for rapid development
- **Environment Variables**: Secure API key management for OpenAI and database

### Production Build
- **Frontend**: Vite builds static assets to `dist/public`
- **Backend**: ESBuild bundles server code to `dist/index.js`
- **Database**: Drizzle migrations for schema management
- **Deployment**: Single-server deployment with static file serving

### Database Configuration
- **PostgreSQL**: Required for production deployment
- **Connection**: Environment variable `DATABASE_URL` for database connection
- **Migrations**: Schema managed through Drizzle migrations in `/migrations`

## Changelog

```
Changelog:
- July 06, 2025. Initial setup
- July 06, 2025. Completed PostgreSQL database integration with Drizzle ORM
- July 06, 2025. Fixed text visibility issues across all components for dark theme
- July 06, 2025. Enhanced chart visualization with vibrant colors (purple, green, orange)
- July 06, 2025. Implemented real WHOOP API integration with OAuth authentication
- July 06, 2025. Added auth callback route and frontend pages for OAuth handling
- July 06, 2025. Configured real domain support for WHOOP OAuth (localhost restrictions)
- July 06, 2025. Migrated to official Passport.js WHOOP OAuth strategy for improved reliability
- July 06, 2025. Configured custom domain support for biodrive.app (DNS configured, awaiting Replit verification)
- July 06, 2025. WHOOP OAuth correctly configured for biodrive.app custom domain (waiting for domain activation)
- July 06, 2025. Implemented advanced AI coaching system with personalized 1:1 recommendations
- July 06, 2025. Added coaching database schema, API routes, and interactive frontend component
- July 06, 2025. Built comprehensive coaching ecosystem: Smart Insights, Goal Tracker, User Preferences, Coaching History
- July 06, 2025. Enhanced dashboard with multi-component AI coaching layout and advanced analytics
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```