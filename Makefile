.PHONY: dev install clean

dev:
	@echo "Starting development servers..."
	@concurrently "make dev-frontend" "make dev-backend"

dev-frontend:
	@echo "Starting frontend..."
	@npm run dev

dev-backend:
	@echo "Starting backend..."
	@cd backend && python main.py

install:
	@echo "Installing dependencies..."
	@npm install
	@cd backend && pip install -r requirements.txt

clean:
	@echo "Cleaning up..."
	@rm -rf node_modules
	@rm -rf .svelte-kit
	@find . -name "__pycache__" -exec rm -rf {} +