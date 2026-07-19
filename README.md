<div align="center">

# 🏢 Trestle

### Enterprise Work Order, Inventory & Billing Platform for Flooring Installation Companies

[![Status](https://img.shields.io/badge/status-live%20in%20production-brightgreen)]()
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)]()
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-encrypted-4169E1?logo=postgresql&logoColor=white)]()
[![AWS](https://img.shields.io/badge/AWS-Fargate%20%7C%20RDS%20%7C%20CloudFront-FF9900?logo=amazonaws&logoColor=white)]()
[![QuickBooks](https://img.shields.io/badge/QuickBooks-Online%20API-2CA01C?logo=quickbooks&logoColor=white)]()
[![Stripe](https://img.shields.io/badge/Stripe-integrated-635BFF?logo=stripe&logoColor=white)]()
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)]()

*A B2B work order platform replacing retail quote-first workflows with direct property-manager submission, role-scoped pricing visibility, and automated QuickBooks/Stripe billing sync.*

</div>

---

## 📋 Overview

Trestle is a production-deployed, multi-tenant SaaS platform built for flooring installation companies managing high-volume property/building relationships. Property and building managers submit work orders directly against pre-configured floor-plan templates — selecting materials and quantities with **zero pricing visibility** — while internal staff and admins handle pricing, approval, scheduling, and billing behind a fully separated back office.

> **Live and deployed on AWS.** Not a prototype — a running, secured, actively maintained platform.

---

## 🏗️ Architecture

```
┌────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CloudFront │────▶│  React SPA   │     │  ECS Fargate │────▶│  RDS Postgres│
│   (CDN/TLS) │     │   (S3 host)  │     │   (Node/API) │     │  (encrypted) │
└─────────────┘     └─────────────┘     └──────┬───────┘     └──────────────┘
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              ┌─────────┐   ┌──────────┐  ┌───────────┐
                              │ Stripe  │   │ QuickBooks│  │  Secrets  │
                              │ Square  │   │  Online   │  │  Manager  │
                              └─────────┘   └──────────┘  └───────────┘
```

| Layer | Technology |
|---|---|
| 🎨 Frontend | React + TypeScript, Vite |
| ⚙️ Backend | Node.js + Express |
| 🗄️ Database | PostgreSQL (encrypted at rest) |
| ☁️ Hosting | AWS ECS Fargate, RDS, S3, CloudFront, ALB |
| 🔐 Secrets | AWS Secrets Manager |
| 💳 Payments | Stripe · Square |
| 📊 Accounting | QuickBooks Online (OAuth2 + auto-sync) |
| 🛡️ Audit | AWS CloudTrail (multi-region) |

---

## ✨ Core Modules

| Module | Description |
|---|---|
| 📝 **Work Orders** | Creation, status tracking, internal approval & pricing workflow |
| 🏘️ **Client Portal** | Role-scoped property manager access — submit against floor-plan templates, zero pricing exposure |
| 🧾 **Invoicing** | Auto-generated from approved work orders, synced to QuickBooks Online |
| 📦 **Inventory & Purchase Orders** | Stock tracking, reorder workflow, vendor management |
| 📈 **Project Tracker** | Lightweight tracking for multi-week projects, feeding summary data into billing |
| 🎛️ **Admin Dashboard** | Pricing, scheduling, approvals, reporting, installer/vendor management |

---

## 🔐 Access Control

Three roles, enforced **server-side** via signed JWT — role and client scoping are never trusted from client-supplied request data:

| Role | Access |
|---|---|
| 👑 `admin` | Full access — pricing, approvals, billing, integrations |
| 🛠️ `staff` | Operational — work orders, inventory, scheduling |
| 🏢 `client` | Property manager — scoped work order submission, **no pricing visibility** |

---

## 🛡️ Security

- ✅ Parameterized SQL queries throughout — zero string-concatenated queries
- ✅ Rate-limited authentication endpoint
- ✅ Server-side role enforcement on every protected route
- ✅ Stripe webhook signature verification with idempotent event processing
- ✅ Security headers via Helmet — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- ✅ Database encryption at rest
- ✅ Zero secrets in version control — AWS Secrets Manager only
- ✅ Multi-region CloudTrail audit logging

---

## 🚀 Local Development

**Prerequisites:** Node.js 22+, PostgreSQL, npm

```bash
# Backend
cd backend
npm install
cp .env.example .env
node src/db/seed.js
npm start

# Frontend
cd frontend
npm install
npm run dev
```

---

## 📊 Status

<div align="center">

**🟢 Actively developed · Deployed on AWS · Production-hardened**

</div>

---

<div align="center">

*Private repository · © BJNEXUS AI*

</div>
