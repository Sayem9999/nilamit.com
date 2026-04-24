# 🚀 Nilamit Deployment Guide

This document outlines the production deployment strategy for the Nilamit platform.

## 🏗️ Architecture Overview
- **Frontend/Backend**: Next.js 15 (Standalone Mode)
- **Database**: Firestore (NoSQL) + RTDB (Real-time Events)
- **Cache/Rate-Limiting**: Upstash Redis
- **Storage**: Firebase Storage + UploadThing
- **Containerization**: Docker (Alpine-based)

## 📦 Production Deployment (Docker)

### 1. Build the Image
```bash
docker build -t nilamit-app .
```

### 2. Run with Docker Compose (Local Simulation)
```bash
docker-compose up -d
```

## ☁️ Cloud Deployment (Recommended: Google Cloud Run)

### 1. Authenticate & Configure
```bash
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]
```

### 2. Deploy from Source
Google Cloud Run can build the Dockerfile automatically:
```bash
gcloud run deploy nilamit-app \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated
```

## 🔐 Environment Setup (Production)

Ensure the following variables are set in your Cloud Provider's Secret Manager:

| Variable | Description |
| :--- | :--- |
| `AUTH_SECRET` | Secret for JWT signing (32+ chars) |
| `FIREBASE_PRIVATE_KEY` | RSA Private key from service account |
| `UPSTASH_REDIS_REST_TOKEN` | Token for rate-limiting |
| `ADMIN_EMAILS` | Comma-separated list of authorized admins |

## 🛠️ Maintenance & Monitoring
- **Logs**: View real-time logs via `gcloud logs read` or the Sentry dashboard.
- **Scaling**: The application is stateless (standalone mode) and can be scaled horizontally from 0 to 1000+ instances.
- **Backups**: Firestore backups should be scheduled via GCP Cloud Scheduler.
