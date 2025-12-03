.PHONY: help dev up down build logs seed-logs pull-model clean

# Default target
help:
	@echo "LogChat - Log-Aware Chatbot MVP"
	@echo ""
	@echo "Usage:"
	@echo "  make up          - Start all services (docker-compose up -d)"
	@echo "  make down        - Stop all services"
	@echo "  make build       - Build all Docker images"
	@echo "  make dev         - Start in development mode with hot reload"
	@echo "  make logs        - View logs from all services"
	@echo "  make seed-logs   - Seed sample logs into the database"
	@echo "  make pull-model  - Pull the Ollama LLM model"
	@echo "  make migrate     - Run Prisma migrations"
	@echo "  make clean       - Remove all containers, volumes, and images"
	@echo ""

# Start all services in detached mode
up:
	docker-compose up -d
	@echo ""
	@echo "✅ Services started!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:3001"
	@echo "   Database: localhost:5432"
	@echo ""
	@echo "⚠️  Don't forget to pull the LLM model: make pull-model"

# Stop all services
down:
	docker-compose down

# Build all Docker images
build:
	docker-compose build

# Development mode with watch for file changes
dev:
	docker-compose up --build

# View logs from all services
logs:
	docker-compose logs -f

# View logs from specific service
logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-db:
	docker-compose logs -f db

logs-ollama:
	docker-compose logs -f ollama

# Pull the Ollama LLM model
pull-model:
	@echo "Pulling qwen2.5 model (this may take a few minutes)..."
	docker exec logchat-ollama ollama pull qwen2.5:3b
	@echo "✅ Model pulled successfully!"

# Run Prisma migrations
migrate:
	docker exec logchat-backend npx prisma migrate deploy
	@echo "✅ Migrations applied!"

# Generate Prisma client
prisma-generate:
	docker exec logchat-backend npx prisma generate

# Seed sample logs
seed-logs:
	@echo "Seeding sample logs..."
	@chmod +x ./scripts/seed-logs.sh
	@./scripts/seed-logs.sh
	@echo "✅ Sample logs seeded!"

# Run backend tests
test:
	docker exec logchat-backend npm test

# Clean everything
clean:
	docker-compose down -v --rmi all --remove-orphans
	@echo "✅ Cleaned up all containers, volumes, and images"

# Reset database
reset-db:
	docker-compose down db
	docker volume rm mini-projet_postgres_data || true
	docker-compose up -d db
	@sleep 3
	docker exec logchat-backend npx prisma migrate deploy
	@echo "✅ Database reset!"

# Shell access to containers
shell-backend:
	docker exec -it logchat-backend sh

shell-db:
	docker exec -it logchat-db psql -U logchat -d logchat

# Health check
health:
	@echo "Checking services..."
	@curl -s http://localhost:3001/health && echo " ✅ Backend OK" || echo " ❌ Backend DOWN"
	@curl -s http://localhost:11434/api/tags > /dev/null && echo " ✅ Ollama OK" || echo " ❌ Ollama DOWN"
	@curl -s http://localhost:3000 > /dev/null && echo " ✅ Frontend OK" || echo " ❌ Frontend DOWN"
