<div align="center">

# 🛡️ LogChat

### AI-Powered SIEM & Log Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![Ollama](https://img.shields.io/badge/Ollama-AI-purple?style=for-the-badge)](https://ollama.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Democratizing Security Analytics with Natural Language**

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [API Reference](#-api-reference) • [Screenshots](#-screenshots)

</div>

---

## 📖 Overview

**LogChat** is a modern, self-hosted **Security Information and Event Management (SIEM)** platform that combines traditional log analysis with the power of Large Language Models (LLMs). Instead of learning complex query languages, simply ask questions in plain English.

> *"Show me all failed login attempts from the last hour"* → LogChat understands and responds.

### Why LogChat?

| Traditional SIEM | LogChat |
|------------------|---------|
| ❌ Expensive licenses (Splunk, IBM QRadar) | ✅ **100% Free & Open Source** |
| ❌ Steep learning curve (SPL, KQL) | ✅ **Natural language queries** |
| ❌ Data sent to cloud providers | ✅ **Fully self-hosted, privacy-first** |
| ❌ Complex multi-day setup | ✅ **One command: `docker-compose up`** |

---

## 🏗️ Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              Docker Network                               │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────┤
│    Frontend     │     Backend     │   PostgreSQL    │       Ollama        │
│   (Next.js)     │    (Express)    │       DB        │     (Local LLM)     │
│   Port: 3000    │   Port: 3001    │   Port: 5432    │    Port: 11434      │
├─────────────────┴────────┬────────┴─────────────────┴─────────────────────┤
│                          │                                                │
│    ┌─────────────────────▼─────────────────────┐                          │
│    │           SIEM Engine (Backend)           │                          │
│    ├───────────────────────────────────────────┤                          │
│    │  • Threat Detection  • ML Anomaly         │                          │
│    │  • Correlation       • UEBA               │                          │
│    │  • SOAR Playbooks    • Alert Management   │                          │
│    └───────────────────────────────────────────┘                          │
└───────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14, TailwindCSS, Recharts, Lucide | UI & Data Visualization |
| **Backend** | Node.js, Express, TypeScript | REST API & Business Logic |
| **Database** | PostgreSQL 16, Prisma ORM | Data Persistence & Queries |
| **AI Engine** | Ollama (qwen2.5:0.5b) | Natural Language Processing |
| **Security** | JWT, bcrypt, RBAC | Authentication & Authorization |
| **DevOps** | Docker, Docker Compose | Containerization & Orchestration |

---

## ✨ Features

### 🤖 AI-Powered Chat Assistant
- Query logs using **natural language** (no SQL or SPL required!)
- Get summarized insights and anomaly explanations
- Powered by **Ollama** (local LLM - no data leaves your server)
- Uses **RAG (Retrieval Augmented Generation)** for context-aware responses

### 📊 Real-Time Security Dashboard (`/dashboard`)
- **Stats Cards**: Total logs, errors, warning counts, threat indicators
- **Timeline Chart**: Logs over time grouped by severity level
- **Services Chart**: Top error-prone services visualization
- **Log Table**: Paginated, filterable, searchable log entries
- **Live Indicators**: Real-time ingestion status

### 🔒 Enterprise SIEM Capabilities
| Feature | Description |
|---------|-------------|
| **Threat Detection** | Pattern-based detection (SQL Injection, Brute Force, XSS, Port Scans) |
| **Correlation Engine** | Link related events across multiple services |
| **Alert Management** | Configurable rules with HIGH/MEDIUM/LOW severity |
| **Incident Tracking** | Full incident lifecycle management |
| **MITRE ATT&CK** | Threat mapping to industry framework |

### 🧠 Advanced Analytics
- **UEBA** (User & Entity Behavior Analytics)
- **ML Anomaly Detection**: Statistical outlier identification using Isolation Forest concepts
- **SOAR Integration**: Automated response playbooks (block IP, disable user, etc.)

### 🔐 Security & Access Control
- **JWT Authentication**: Stateless, secure sessions
- **Role-Based Access Control**: `ADMIN`, `STAFF`, `USER` roles
- **Audit Logging**: Immutable trail of all critical actions
- **bcrypt Hashing**: Secure password storage

### 💬 Intelligent Chat (`/chat`)
- **AI-Powered Analysis**: Ask questions about your logs in natural language
- **Smart Filters**: Filter by time range, service, and log level
- **Context-Aware**: LLM receives relevant logs and statistics for accurate responses
- **Suggested Questions**: Get started with pre-built prompts
- **Markdown Rendering**: AI responses support code blocks, lists, and formatting

### 📥 Log Ingestion
- **Structured Logs**: JSON format with timestamp, level, service, message, meta
- **Raw Logs**: Auto-parsing of standard log line formats
- **Batch Support**: Ingest multiple logs at once via `/api/logs/batch`
- **Real-time Processing**: Logs are analyzed for threats immediately upon ingestion

---

## 🚀 Quick Start

### Prerequisites
- **Docker** & **Docker Compose** v2+
- **8GB RAM** minimum (for AI model)
- **Git**
- (Optional) **Make** for convenience commands

### 1. Clone and Start

```bash
# Clone the repository
git clone https://github.com/sbeving/logchat.git
cd logchat

# Start all services
make up
# OR without make:
docker-compose up -d --build
```

### 2. Run Database Migrations

```bash
# Apply Prisma migrations
docker-compose exec backend npx prisma migrate deploy
```

### 3. Pull the AI Model

```bash
# Pull the Ollama model (required for chat functionality)
make pull-model
# OR manually:
docker exec logchat-ollama ollama pull qwen2.5:0.5b
```

### 4. Seed Sample Data (Optional)

```bash
# Seed 100 sample logs for testing
make seed-logs
# OR manually:
./scripts/seed-logs.sh 100
```

### 5. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3000/dashboard | Main monitoring view |
| **Chat** | http://localhost:3000/chat | AI assistant |
| **Login** | http://localhost:3000/login | Authentication |
| **Admin** | http://localhost:3000/admin | Admin panel |
| **API** | http://localhost:3001 | Backend REST API |
| **Health** | http://localhost:3001/health | Service health check |

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@logchat.io` | `admin123` |
| User | `user@logchat.io` | `user123` |

---

## 📁 Project Structure

```
logchat/
├── backend/                    # Express API Server
│   ├── src/
│   │   ├── index.ts           # App entry point
│   │   ├── routes/            # API route handlers
│   │   │   ├── logs.ts        # Log ingestion & queries
│   │   │   ├── analytics.ts   # Stats endpoints
│   │   │   ├── chat.ts        # Chat endpoint
│   │   │   ├── auth.ts        # Authentication
│   │   │   ├── admin-analytics.ts
│   │   │   └── integrations.ts
│   │   ├── services/          # Business logic
│   │   │   ├── logs.ts        # Log parsing & DB ops
│   │   │   ├── analytics.ts   # Stats calculations
│   │   │   ├── ollama.ts      # LLM client
│   │   │   ├── auth.ts        # JWT & bcrypt
│   │   │   └── siem/          # 🛡️ SIEM Engine
│   │   │       ├── threat-detection.ts
│   │   │       ├── correlation.ts
│   │   │       ├── ml-anomaly.ts
│   │   │       ├── soar.ts
│   │   │       └── ueba.ts
│   │   └── middleware/
│   │       └── auth.ts        # JWT verification
│   └── prisma/
│       ├── schema.prisma      # Database schema
│       └── migrations/        # DB migrations
│
├── frontend/                   # Next.js Application
│   ├── app/
│   │   ├── layout.tsx         # Root layout with Navbar
│   │   ├── page.tsx           # Landing (redirects)
│   │   ├── dashboard/         # Security dashboard
│   │   ├── chat/              # AI chatbot interface
│   │   ├── login/             # Authentication page
│   │   └── admin/             # Admin panels
│   │       ├── analytics/
│   │       └── log-sources/
│   ├── components/            # Reusable React components
│   │   ├── Navbar.tsx
│   │   ├── StatsCards.tsx
│   │   ├── LogsChart.tsx
│   │   ├── ServicesChart.tsx
│   │   ├── LogTable.tsx
│   │   ├── LogDetailModal.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── Gauge.tsx
│   │   ├── LiveIndicator.tsx
│   │   └── Toast.tsx
│   └── lib/
│       ├── api.ts             # API client
│       └── auth-context.tsx   # Auth state management
│
├── scripts/
│   ├── seed-logs.sh           # Sample data generator
│   └── live-seed.sh           # Continuous log simulation
│
├── report/                     # 📄 LaTeX Project Report
│   ├── LogChat_Report.tex
│   ├── diagrams/              # PlantUML source files
│   └── figures/               # Screenshots & images
│
├── docker-compose.yml          # Service orchestration
├── Makefile                    # Helper commands
└── README.md                   # You are here!
```

---

## 🛡️ Security Features

### Threat Detection Patterns

| Pattern | Severity | Description |
|---------|----------|-------------|
| SQL Injection | 🔴 **Critical** | Detects `' OR 1=1`, `--`, `DROP TABLE`, `UNION SELECT` |
| Brute Force | 🟠 **High** | 5+ failed logins within 60 seconds |
| XSS Attempt | 🟠 **High** | `<script>`, `javascript:`, `onerror=` in input |
| Command Injection | 🔴 **Critical** | Shell metacharacters `;`, `&&`, `\|` in params |
| Port Scan | 🟡 **Medium** | Rapid connection attempts from single IP |
| Privilege Escalation | 🔴 **Critical** | Unauthorized admin access attempts |
| Data Exfiltration | 🟠 **High** | Large data transfers to external IPs |

### MITRE ATT&CK Mapping

LogChat maps detected threats to the [MITRE ATT&CK](https://attack.mitre.org/) framework for standardized threat classification.

---

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

| Prompt | What it does |
|--------|--------------|
| "What issues occurred in the last hour?" | Summary of recent problems |
| "Summarize the error patterns I should be aware of" | Pattern analysis |
| "Which services have the most errors?" | Service health ranking |
| "What's happening with auth-service?" | Service-specific deep dive |
| "Give me a health overview of the system" | System-wide status |
| "What are the most critical errors right now?" | Priority triage |
| "Show me failed login attempts" | Security-focused query |
| "Explain the spike in errors at 3 PM" | Temporal analysis |

---

## 📸 Screenshots

> **Note**: Add your own screenshots to the `docs/screenshots/` folder

### Security Dashboard
![Dashboard](docs/screenshots/dashboard.png)
*Real-time security metrics and log visualization*

### AI Chat Interface
![Chat](docs/screenshots/chat.png)
*Natural language log analysis with the AI assistant*

### Log Explorer
![Logs](docs/screenshots/logs.png)
*Searchable, filterable log table with pagination*

### Admin Panel
![Admin](docs/screenshots/admin.png)
*User management and system configuration*

---

## ⚙️ Configuration

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
JWT_SECRET=your-super-secret-key-change-in-production

# Ollama
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:0.5b

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
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

---

## 🧪 Testing

```bash
# Run backend tests
make test
# OR
docker exec logchat-backend npm test

# Check API health
curl http://localhost:3001/health
```

---

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

---

## 🗺️ Roadmap

- [x] Core log ingestion API
- [x] Real-time security dashboard
- [x] AI chatbot integration (Ollama)
- [x] SIEM threat detection engine
- [x] User authentication (JWT)
- [x] Role-based access control
- [x] Docker deployment
- [ ] Elasticsearch backend (for massive scale)
- [ ] Email/Slack alert notifications
- [ ] Custom alert rule builder UI
- [ ] Mobile companion app
- [ ] Kubernetes Helm chart
- [ ] SSO/SAML integration

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Saleh Eddine Touil** - *Full Stack Development*
- **Chames Edin Turki** - *Backend & AI Integration*

**Supervised by:** Mr. Mounir Kthiri

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/), [Express](https://expressjs.com/), [Prisma](https://www.prisma.io/)
- AI powered by [Ollama](https://ollama.ai/) with [Qwen2.5](https://huggingface.co/Qwen)
- Charts by [Recharts](https://recharts.org/)
- Icons by [Lucide](https://lucide.dev/)
- Styling with [TailwindCSS](https://tailwindcss.com/)

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with ❤️ for the Cybersecurity Community

[Report Bug](https://github.com/sbeving/logchat/issues) · [Request Feature](https://github.com/sbeving/logchat/issues)

</div>
