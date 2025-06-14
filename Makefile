.PHONY: dev install clean

dev:
	@echo "Starting development servers..."
	@make -j2 "dev-frontend" "dev-backend"

dev-frontend:
	@echo "Starting frontend..."
	@cd frontend && npm start

dev-backend:
	@echo "Starting backend..."
	@cd backend && python main.py

install:
	@echo "Installing dependencies..."
	@cd frontend && npm install
	@cd backend && pip install -r requirements.txt

clean:
	@echo "Cleaning up..."
	@rm -rf node_modules
	@rm -rf .svelte-kit
	@find . -name "__pycache__" -exec rm -rf {} +