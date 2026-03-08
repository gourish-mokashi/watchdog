<h1 align="center"><img src="client/public/logo2.png" height="40" style="vertical-align: middle;" /> Watchdog</h1>

<p align="center">
  <strong>AI-Powered Security Event Detection, Analysis & Response Platform</strong>
</p>

<p align="center">
  <a href="#architecture">Architecture</a> •
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**Watchdog** is an end-to-end security monitoring platform that ingests real-time alerts from open-source security tools — [Falco](https://falco.org/), [Suricata](https://suricata.io/), [Wazuh](https://wazuh.com/), and [Zeek](https://zeek.org/) — and uses AI agents to perform automated threat analysis, generate PDF reports, and write context-aware detection rules.

It is designed for teams and individuals who want to reduce alert fatigue, auto-triage security events, and maintain high-signal detection rules across their infrastructure.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Host / Infrastructure                          │
│                                                                         │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│   │   Falco   │  │ Suricata  │  │   Wazuh   │  │   Zeek    │           │
│   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘           │
│         │               │               │               │               │
│         └───────────────┼───────────────┼───────────────┘               │
│                         ▼                                               │
│                 ┌───────────────┐                                        │
│                 │    Daemon     │  Go binary — receives alerts,          │
│                 │  (Agent API)  │  exposes tool APIs for AI agents       │
│                 └───────┬───────┘                                        │
│                         │ HTTP                                           │
└─────────────────────────┼────────────────────────────────────────────────┘
                          │
                          ▼
                ┌─────────────────┐     ┌──────────────┐
                │     Server      │────▶│  PostgreSQL   │
                │  (Express API)  │     └──────────────┘
                │                 │     ┌──────────────┐
                │  AI Agents:     │────▶│    Redis      │
                │  • Threat       │     └──────────────┘
                │    Analysis     │     ┌──────────────┐
                │  • Rule Writer  │────▶│   AWS S3      │
                │  • Project      │     │  (PDF reports)│
                │    Summariser   │     └──────────────┘
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │     Client      │
                │   (Next.js)     │
                │   Dashboard     │
                └─────────────────┘
```

## Features

- **Real-Time Alert Ingestion** — The daemon captures live alerts from Falco (with Suricata, Wazuh, and Zeek support planned) and forwards them to the server via HTTP.
- **AI Threat Analysis** — An OpenAI Agents-powered SOC analyst triages each event, producing a structured verdict with confidence scores, evidence breakdown, and response recommendations.
- **PDF Report Generation** — Analysis results are rendered into professional PDF reports and stored in AWS S3 with pre-signed URL access.
- **AI Rule Writer** — An agentic workflow reads your project summary, consults tool-specific rule-writing guides, and writes/validates/deploys custom detection rules directly on the host.
- **Project Summariser** — An AI agent scans your codebase to produce a security-focused summary that powers context-aware rule writing and reduces false positives.
- **Interactive TUI Installer** — A Charm-powered terminal UI for selecting and installing security tools (Falco, Suricata, Wazuh) on the host with a single command.
- **Event Dashboard** — A Next.js web interface for browsing, filtering, and analysing security events with date-range filters, priority badges, and one-click threat analysis.
- **Deduplication** — Repeated alerts of the same type are automatically deduplicated and counted rather than creating noise.
- **Redis-Backed Agent Memory** — AI agent sessions are persisted in Redis for contextual continuity across analysis runs.

## Tech Stack

| Layer | Technology |
|---|---|
| **Client** | Next.js 16, React 19, Tailwind CSS 4, Radix UI, PrismJS |
| **Server** | Express 5, TypeScript, Prisma ORM (PostgreSQL), OpenAI Agents SDK, PDFKit |
| **AI** | Ollama (local models), OpenAI Agents SDK, AI SDK (Anthropic/Groq/OpenAI/OpenRouter) |
| **Daemon** | Go, Charm Bubbletea (TUI), net/http |
| **Infrastructure** | PostgreSQL 17, Redis 8.4, AWS S3, Docker Compose |

## Getting Started

### Prerequisites

- **Node.js** ≥ 20 and **pnpm** ≥ 10
- **Go** ≥ 1.22
- **Docker** and **Docker Compose**
- **Ollama** (for local model inference) — [Install Ollama](https://ollama.com/download)
- An **AWS account** with S3 access (for report storage)

### 1. Clone the Repository

```bash
git clone https://github.com/gourish-mokashi/watchdog.git
cd watchdog
```

### 2. Start Infrastructure Services

```bash
cd server
docker compose up -d
```

This starts **PostgreSQL**, **Redis**, and **Redis Insight**.

### 3. Set Up the Server

```bash
cd server
cp .env.example .env          # edit .env with your credentials
pnpm install
npx prisma migrate deploy     # apply database migrations
pnpm dev                      # starts on port 3000
```

**Environment Variables** (`.env`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default: `3000`) |
| `DAEMON_BASE_URL` | Daemon API endpoint (default: `http://localhost:4000`) |
| `AWS_REGION` | AWS region for S3 |
| `AWS_S3_BUCKET` | S3 bucket name for threat reports |
| `REPORT_URL_TTL_SECONDS` | Pre-signed URL expiry (default: `600`) |
| `DEBUG_AI` | Enable AI debug logging (`1` to enable) |

### 4. Set Up the Client

```bash
cd client
pnpm install
pnpm dev                      # starts on port 3001
```

### 5. Build and Run the Daemon

```bash
cd daemon
make build                    # builds to ./bin/watchdog
```

**Initialize security tools (interactive TUI):**

```bash
sudo ./bin/watchdog init
```

**Run the daemon:**

```bash
export WATCHDOG_BACKEND_URL="http://localhost:3000"
./bin/watchdog
```

The daemon exposes:
- **Port 8080** — Agent API (file read/write/edit, rule validation, service restart)
- **Port 8081** — Falco HTTP alert receiver

### 6. Pull the AI Model

```bash
ollama pull minimax-m2.5:cloud
```

## Project Structure

```
watchdog/
├── client/                    # Next.js dashboard
│   └── src/
│       ├── app/               # Pages & API routes
│       │   ├── events/all/    # Event listing with filters
│       │   ├── event/[id]/    # Event detail + analysis trigger
│       │   └── api/events/    # Proxy routes to server
│       └── components/        # Reusable UI components
│
├── daemon/                    # Go daemon process
│   ├── cmd/daemon/            # Entry point
│   ├── internal/
│   │   ├── dispatcher/        # HTTP alert forwarding to server
│   │   ├── installers/        # Falco, Suricata, Wazuh installers
│   │   ├── reciever/          # Agent API (file ops, validation)
│   │   └── ui/                # Charm Bubbletea TUI
│   ├── pkg/models/            # Shared event model
│   └── watchers/              # Tool-specific alert listeners
│
└── server/                    # Express API + AI agents
    ├── prisma/                # Database schema & migrations
    ├── skills/                # Rule-writing knowledge base
    │   └── rule-writing-guidelines/
    │       ├── SKILL.md       # Skill overview
    │       ├── watchdog.yaml  # Tool paths & commands
    │       ├── falco.md       # Falco rule-writing guide
    │       ├── suricata.md    # Suricata rule-writing guide
    │       ├── wazuh.md       # Wazuh rule-writing guide
    │       └── zeek.md        # Zeek rule-writing guide
    └── src/
        ├── agents/            # AI agent definitions
        │   ├── threat-analysis.ts    # SOC analyst agent
        │   ├── rule-writer.ts        # Detection rule agent
        │   ├── project-summariser.ts # Codebase analysis agent
        │   └── memory/redis.ts       # Redis session store
        ├── controller/        # Route handlers
        ├── services/          # Business logic
        │   ├── threatAnalysisQueue.ts # Background analysis queue
        │   ├── pdfReportRenderer.ts   # PDF generation
        │   ├── awsReportStorage.ts    # S3 upload/signed URLs
        │   └── daemonToolsClient.ts   # Daemon API client
        └── routes/            # Express route definitions
```

## API Reference

### Event Routes (`/events`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/events/new` | Create or deduplicate an event (used by daemon) |
| `GET` | `/events/all` | List events with date range/sort/pagination filters |
| `GET` | `/events/:uuid` | Get event by ID |
| `GET` | `/events/analyse/:uuid` | Trigger AI threat analysis for an event |
| `GET` | `/events/status/:uuid` | Poll analysis completion status |

### Generate Routes (`/generate`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/generate/rules?toolname=falco` | Generate detection rules for a tool |
| `POST` | `/generate/summary` | Generate project security summary |

### Daemon Agent API (`:8080`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/tools/read?path=` | Read a file from the host |
| `POST` | `/tools/write` | Write content to a file on the host |
| `POST` | `/tools/edit` | Replace content in a file on the host |
| `GET` | `/tools/validate?toolname=` | Validate rule syntax for a tool |
| `GET` | `/tools/restart?toolname=` | Restart a security tool service |
| `GET` | `/tools/direnum?path=&level=` | Enumerate directory structure |

## AI Agents

### Threat Analysis Agent
Receives a security event and produces a structured incident report with verdict (Genuine / False Positive / Inconclusive), confidence score, key evidence, response recommendations, and safe tuning suggestions. Reports are rendered to PDF and stored in S3.

### Rule Writer Agent
Reads the project summary and tool-specific rule-writing guides, then writes detection rules, validates their syntax via the daemon, and restarts the security tool — all autonomously through tool-use.

### Project Summariser Agent
Enumerates and reads your codebase through the daemon's file API to produce a security-focused project summary. This summary powers context-aware rule writing and helps the threat analysis agent distinguish expected behavior from genuine threats.

## License

This project is open-source. See the repository for license details.
