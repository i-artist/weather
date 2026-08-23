SHELL := /bin/sh

COMPOSE ?= docker compose
ENV_FILE ?= .env
COMPOSE_CMD = $(COMPOSE) --env-file $(ENV_FILE)
PROXY_COMPOSE_CMD = $(COMPOSE_CMD) -f docker-compose.yml -f docker-compose.proxy.yml

.DEFAULT_GOAL := help

.PHONY: help init check-windy-env check-env check-proxy-env up build pull down restart logs ps health proxy-up proxy-down proxy-logs proxy-health

help:
	@echo "make init     Create .env from .env.example"
	@echo "make up       Build and start all services"
	@echo "make pull     Pull base images and rebuild services"
	@echo "make down     Stop all services"
	@echo "make restart  Restart all services"
	@echo "make logs     Follow service logs"
	@echo "make ps       Show service status"
	@echo "make health   Check the public HTTP endpoint"
	@echo "make proxy-up Start only the Windy proxy service"
	@echo "make proxy-down Stop the Windy proxy service"
	@echo "make proxy-logs Follow Windy proxy logs"
	@echo "make proxy-health Check the Windy proxy endpoint"

init:
	@test -f "$(ENV_FILE)" || cp .env.example "$(ENV_FILE)"
	@echo "Configure $(ENV_FILE), then run: make up"

check-windy-env:
	@test -f "$(ENV_FILE)" || { echo "Missing $(ENV_FILE). Run 'make init' first."; exit 1; }
	@key="$$(sed -n 's/^WINDY_API_KEY=//p' "$(ENV_FILE)" | tail -n 1)"; \
		test -n "$$key" && test "$$key" != "replace-with-your-windy-map-api-key" || { \
			echo "WINDY_API_KEY is not configured in $(ENV_FILE)."; exit 1; \
		}

check-env: check-windy-env
	@port="$$(sed -n 's/^WEATHER_PORT=//p' "$(ENV_FILE)" | tail -n 1)"; \
		port="$${port:-8080}"; \
		case "$$port" in *[!0-9]*) echo "WEATHER_PORT must be an integer from 1 to 65535, got: $$port"; exit 1;; esac; \
		if [ "$$port" -lt 1 ] || [ "$$port" -gt 65535 ]; then \
			echo "WEATHER_PORT must be between 1 and 65535, got: $$port"; exit 1; \
		fi

check-proxy-env: check-windy-env
	@port="$$(sed -n 's/^WINDY_PROXY_PORT=//p' "$(ENV_FILE)" | tail -n 1)"; \
		port="$${port:-8024}"; \
		case "$$port" in *[!0-9]*) echo "WINDY_PROXY_PORT must be an integer from 1 to 65535, got: $$port"; exit 1;; esac; \
		if [ "$$port" -lt 1 ] || [ "$$port" -gt 65535 ]; then \
			echo "WINDY_PROXY_PORT must be between 1 and 65535, got: $$port"; exit 1; \
		fi

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

proxy-up: check-proxy-env
	-$(COMPOSE_CMD) stop weather
	-$(COMPOSE_CMD) rm -f weather
	$(PROXY_COMPOSE_CMD) up --build -d windy-proxy
	$(PROXY_COMPOSE_CMD) ps windy-proxy

proxy-down: check-proxy-env
	$(PROXY_COMPOSE_CMD) stop windy-proxy

proxy-logs: check-proxy-env
	$(PROXY_COMPOSE_CMD) logs -f --tail=200 windy-proxy

proxy-health: check-proxy-env
	@port="$$(sed -n 's/^WINDY_PROXY_PORT=//p' "$(ENV_FILE)" | tail -n 1)"; \
		port="$${port:-8024}"; \
		curl --fail --silent --show-error "http://127.0.0.1:$$port/windy/health"; \
		echo
