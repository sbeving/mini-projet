# LogChat - Log-Aware Chatbot Dashboard 🤖📊

A **Mini PFA project** that provides a log-aware chatbot and dashboard for application monitoring. It ingests logs, runs analysis, and lets users chat with an AI agent that explains system behavior based on those logs.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Frontend](https://img.shields.io/badge/Frontend-Next.js%2014-black)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)
![Database](https://img.shields.io/badge/Database-PostgreSQL-316192)
![AI](https://img.shields.io/badge/AI-Ollama%20LLM-orange)

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│   (Next.js)     │     │   (Express)     │     │                 │
│   Port: 3000    │     │   Port: 3001    │     │   Port: 5432    │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │     Ollama      │
                        │   (LLM API)     │
                        │   Port: 11434   │
                        │                 │
                        └─────────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 14, TypeScript, TailwindCSS | Dashboard UI, Chat interface |
| **Backend** | Node.js, Express, TypeScript, Prisma | REST API, Log processing |
| **Database** | PostgreSQL 16 | Log storage, analytics queries |
| **LLM** | Ollama (qwen2.5:0.5b) | AI-powered log analysis |

## ✨ Features

### 📊 Dashboard (`/dashboard`)
- **Stats Cards**: Total logs, errors, warning counts, error rates
- **Timeline Chart**: Logs over time grouped by level
- **Services Chart**: Top error-prone services
- **Log Table**: Paginated, filterable log entries

### 💬 Chat (`/chat`)
- **AI-Powered Analysis**: Ask questions about your logs in natural language
- **Smart Filters**: Filter by time range, service, and log level
- **Context-Aware**: LLM receives relevant logs and statistics for accurate responses
- **Suggested Questions**: Get started with pre-built prompts

### 📥 Log Ingestion
- **Structured Logs**: JSON format with timestamp, level, service, message, meta
- **Raw Logs**: Auto-parsing of standard log line formats
- **Batch Support**: Ingest multiple logs at once

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- (Optional) Make

### 1. Clone and Start

```bash
# Clone the repository
git clone https://github.com/sbeving/mini-projet
cd mini-projet

# Start all services
make up
# OR without make:
docker-compose up -d --build
```

### 2. Pull the AI Model

```bash
# Pull the Ollama model (required for chat functionality)
make pull-model
# OR manually:
docker exec logchat-ollama ollama pull qwen2.5:0.5b
```

### 3. Seed Sample Data

```bash
# Seed 100 sample logs
make seed-logs
# OR manually:
./scripts/seed-logs.sh 100
```

### 4. Access the Application

| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:3000/dashboard |
| **Chat** | http://localhost:3000/chat |
| **Backend API** | http://localhost:3001 |
| **Health Check** | http://localhost:3001/health |

## 📝 API Reference

### Log Ingestion

**POST `/api/logs`** - Ingest a single log

```bash
# Structured format
curl -X POST http://localhost:3001/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-01-01T12:34:56Z",
    "level": "ERROR",
    "service": "auth-service",
    "message": "Failed to validate token",
    "meta": {"user_id": "123", "ip": "10.0.0.1"}
  }'

# Raw format (auto-parsed)
curl -X POST http://localhost:3001/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "message": "2025-01-01T12:34:56Z [ERROR] auth-service: Failed to validate token"
  }'
```

**POST `/api/logs/batch`** - Ingest multiple logs

```bash
curl -X POST http://localhost:3001/api/logs/batch \
  -H "Content-Type: application/json" \
  -d '[
    {"level": "INFO", "service": "api", "message": "Request received"},
    {"level": "ERROR", "service": "api", "message": "Request failed"}
  ]'
```

### Query Logs

**GET `/api/logs`** - Query logs with filters

```bash
# All recent logs
curl "http://localhost:3001/api/logs?limit=50"

# Filter by level
curl "http://localhost:3001/api/logs?level=ERROR"

# Filter by service and time
curl "http://localhost:3001/api/logs?service=auth-service&startTime=2025-01-01T00:00:00Z"
```

### Analytics

**GET `/api/analytics/stats`** - Dashboard statistics

```bash
curl "http://localhost:3001/api/analytics/stats?range=24h"
```

**GET `/api/analytics/timeline`** - Logs over time

```bash
curl "http://localhost:3001/api/analytics/timeline?range=1h"
```

### Chat

**POST `/api/chat`** - Send a chat message

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What errors occurred in the last hour?",
    "filters": {
      "timeRange": "1h"
    }
  }'
```

## 💡 Example Chat Prompts

Try these questions in the chat:

- "What issues occurred in the last hour?"
- "Summarize the error patterns I should be aware of"
- "Which services have the most errors?"
- "What's happening with auth-service?"
- "Give me a health overview of the system"
- "What are the most critical errors right now?"

## 🛠️ Development

### Project Structure

```
mini-projet/
├── backend/                 # Express API server
│   ├── src/
│   │   ├── index.ts        # App entry point
│   │   ├── routes/         # API route handlers
│   │   │   ├── logs.ts     # Log ingestion & queries
│   │   │   ├── analytics.ts # Stats endpoints
│   │   │   └── chat.ts     # Chat endpoint
│   │   └── services/       # Business logic
│   │       ├── logs.ts     # Log parsing & DB ops
│   │       ├── analytics.ts # Stats calculations
│   │       └── ollama.ts   # LLM client
│   └── prisma/
│       └── schema.prisma   # Database schema
│
├── frontend/               # Next.js application
│   ├── app/
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Landing (redirects to dashboard)
│   │   ├── dashboard/     # Dashboard page
│   │   └── chat/          # Chat page
│   ├── components/        # React components
│   │   ├── Navbar.tsx
│   │   ├── StatsCards.tsx
│   │   ├── LogsChart.tsx
│   │   ├── ServicesChart.tsx
│   │   ├── LogTable.tsx
│   │   └── ChatWindow.tsx
│   └── lib/
│       └── api.ts         # API client
│
├── scripts/
│   └── seed-logs.sh       # Sample data generator
│
├── docker-compose.yml     # Service orchestration
├── Makefile              # Common commands
└── README.md
```

### Make Commands

```bash
make help         # Show all commands
make up           # Start all services
make down         # Stop all services
make build        # Build Docker images
make dev          # Development mode with hot reload
make logs         # View all logs
make seed-logs    # Seed sample data
make pull-model   # Pull Ollama model
make migrate      # Run database migrations
make health       # Check service health
make clean        # Remove all containers and volumes
```

### Environment Variables

Create a `.env` file in the root (see `.env.example`):

```env
# Database
POSTGRES_USER=logchat
POSTGRES_PASSWORD=logchat123
POSTGRES_DB=logchat

# Backend
NODE_ENV=development
DATABASE_URL=postgresql://logchat:logchat123@db:5432/logchat

# Ollama
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:0.5b

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🧪 Testing

```bash
# Run backend tests
make test
# OR
docker exec logchat-backend npm test
```

## 🐛 Troubleshooting

### Services not starting
```bash
# Check service logs
make logs

# Restart everything
make down && make up
```

### Chat not working
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Pull the model
make pull-model

# Check Ollama logs
docker logs logchat-ollama
```

### Database issues
```bash
# Reset database
make reset-db

# Run migrations manually
docker exec logchat-backend npx prisma migrate deploy
```

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/), [Express](https://expressjs.com/), [Prisma](https://www.prisma.io/)
- AI powered by [Ollama](https://ollama.ai/)
- Charts by [Recharts](https://recharts.org/)
- Icons by [Lucide](https://lucide.dev/)
