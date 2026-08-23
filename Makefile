SHELL := /bin/sh

COMPOSE ?= docker compose
ENV_FILE ?= .env
COMPOSE_CMD = $(COMPOSE) --env-file $(ENV_FILE)

.DEFAULT_GOAL := help

.PHONY: help init check-env up build pull down restart logs ps health

help:
	@echo "make init     Create .env from .env.example"
	@echo "make up       Build and start all services"
	@echo "make pull     Pull base images and rebuild services"
	@echo "make down     Stop all services"
	@echo "make restart  Restart all services"
	@echo "make logs     Follow service logs"
	@echo "make ps       Show service status"
	@echo "make health   Check the public HTTP endpoint"

init:
	@test -f "$(ENV_FILE)" || cp .env.example "$(ENV_FILE)"
	@echo "Configure $(ENV_FILE), then run: make up"

check-env:
	@test -f "$(ENV_FILE)" || { echo "Missing $(ENV_FILE). Run 'make init' first."; exit 1; }
	@key="$$(sed -n 's/^WINDY_API_KEY=//p' "$(ENV_FILE)" | tail -n 1)"; \
		test -n "$$key" && test "$$key" != "replace-with-your-windy-map-api-key" || { \
			echo "WINDY_API_KEY is not configured in $(ENV_FILE)."; exit 1; \
		}

up: check-env
	$(COMPOSE_CMD) up --build -d --remove-orphans
	$(COMPOSE_CMD) ps

build: check-env
	$(COMPOSE_CMD) build

pull: check-env
	$(COMPOSE_CMD) build --pull
	$(COMPOSE_CMD) up -d --remove-orphans
	$(COMPOSE_CMD) ps

down: check-env
	$(COMPOSE_CMD) down

restart: check-env
	$(COMPOSE_CMD) restart

logs: check-env
	$(COMPOSE_CMD) logs -f --tail=200

ps: check-env
	$(COMPOSE_CMD) ps

health: check-env
	@port="$$(sed -n 's/^WEATHER_PORT=//p' "$(ENV_FILE)" | tail -n 1)"; \
		port="$${port:-8080}"; \
		curl --fail --silent --show-error "http://127.0.0.1:$$port/" >/dev/null; \
		echo "weather service is healthy on port $$port"
