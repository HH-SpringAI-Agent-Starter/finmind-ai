SHELL := /bin/bash

.PHONY: up down run test ingest ask anomaly

up:
	docker compose up -d postgres

down:
	docker compose down

run:
	mvn spring-boot:run

test:
	mvn test

ingest:
	curl -X POST http://localhost:8080/api/knowledge/ingest | jq

ask:
	curl -s -X POST http://localhost:8080/api/agent/ask \
		-H 'Content-Type: application/json' \
		-d '{"question":"请分析苹果公司的最新财报重点，并指出主要风险。","ticker":"AAPL","horizon":"3-6个月","riskProfile":"稳健型"}' | jq

anomaly:
	curl -s -X POST http://localhost:8080/api/market/anomaly \
		-H 'Content-Type: application/json' \
		-d '{"symbol":"IBM","lookbackDays":20,"priceMoveThresholdPct":3.0,"volumeSpikeMultiplier":1.8}' | jq
