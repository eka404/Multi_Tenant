# Issue Tracker

![CI](https://github.com/eka404/Multi_Tenant/actions/workflows/ci.yml/badge.svg)

A multi-tenant issue tracker (think a small Linear or Jira) built with the MERN stack in TypeScript. Teams get private organizations, role-based permissions, and a kanban board that updates live on everyone's screen.

**Live website:** [Open the app](https://multi-tenant-tan-seven.vercel.app)

The frontend is hosted on Vercel and the API runs on Render. Render's free
service may sleep when idle, so the first login or API request after a quiet
period can take about a minute.

**Demo accounts** (available after the production database has been seeded;
password for both: `demo-password-123`)

| Email | Role |
|---|---|
| demo.owner@example.com | Owner |
| demo.dev@example.com | Contributor |

Log in as each in two browser windows and drag a card in one to watch the other update.

<!-- Add board and live-sync screenshots under docs/screenshots before linking them here. -->

## Features

- **Organizations and roles.** Four roles (owner, lead, contributor, guest). Every query is scoped to the caller's organization, so one team can never see another's data.
- **Projects and a kanban board.** Drag tickets between Todo, In Progress, Review and Done.
- **Ticket search.** Search tickets with a MongoDB full-text index, ranked by relevance and scoped to the organization.
- **Analytics dashboard for leads and owners.** View status and priority breakdowns, weekly throughput, workload per person, and average cycle time.
- **Real-time sync.** Changes appear on every collaborator's screen without a refresh, over Socket.io.
- **Comments, @mentions and notifications.** Mentioning a teammate notifies them live; the bell shows an unread count.
- **Secure sessions.** Short-lived access tokens, an httpOnly refresh cookie, and silent token refresh.
- **Production hardening.** Rate limiting, input allow-lists, security headers, and an automated test suite.

## Architecture

```mermaid
flowchart LR
    U[Browser: React SPA on Vercel] -->|REST + JWT| A
    U <-->|WebSocket| A
    subgraph R[Render: Docker container]
        A[Express API + Socket.io]
    end
    A --> D[(MongoDB Atlas)]
    G[GitHub Actions] -->|deploy hook after CI passes| R
```

The frontend and backend are deployed separately: Vercel serves the React app,
while Render serves the API and Socket.io. The browser connects across these
origins, so the backend's `CLIENT_ORIGIN` must match the Vercel site URL.

## Tech stack

| Area | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, dnd-kit, React Router, Axios |
| Backend | Node.js, Express, TypeScript, Mongoose, Socket.io |
| Database | MongoDB (Atlas in production) |
| Security | JWT, bcrypt, Helmet, express-rate-limit |
| Testing | Vitest, Supertest, real MongoDB (no mocks) |
| DevOps | Docker (multi-stage builds), Docker Compose, GitHub Actions, Render |

## Engineering decisions

- **Multi-tenancy through a membership collection.** Users do not belong to an organization directly. A `Membership(userId, orgId, role)` document joins them, so one person can have different roles in different organizations. Tickets also store their own `orgId`, which lets the board query hit a single compound index `(orgId, projectId, status)` without joins. Trade-off: `orgId` is stored twice, so it must never be editable after creation (see the allow-list below).
- **Tenant isolation enforced in the query, not only the route.** Updates and deletes filter on both the ticket id and the caller's `orgId`. Knowing another organization's ticket id is not enough to touch it, and automated tests cover this.
- **Tokens.** The access token lives in memory (not `localStorage`) and expires in 15 minutes. The refresh token is an httpOnly cookie. An Axios interceptor refreshes on a 401 and retries the request once, and concurrent failures share a single refresh call. Trade-off: a page reload needs one extra round trip to restore the session.
- **Real-time rooms with authorization.** Each project is a Socket.io room. Joining checks that the user belongs to the project's organization, the same rule the REST routes use. The client re-joins and reloads the board after any reconnect, because rooms do not survive a dropped connection.
- **Optimistic drag-and-drop.** The card moves instantly and snaps back if the server rejects the change (for example, a guest trying to edit).
- **Mass-assignment protection.** `PATCH /tickets/:id` accepts only an allow-list of fields. Without it, a client could send `orgId` and move a ticket into another tenant. Assignees must also be members of the organization.
- **Search index and relevance.** Search uses a compound text index with `orgId` as the prefix, so queries are tenant-scoped and index-backed. Title matches are weighted 5x over description matches. Trade-off: `$text` matches whole stemmed words only.
- **Analytics aggregation.** Analytics use a single `$facet` aggregation, so MongoDB scans the organization's tickets once and returns every chart's data together. The match on `orgId` uses the existing compound index. A `completedAt` field is set when a ticket enters Done, which makes cycle time possible. Trade-off: this records only the latest completion, not the full status history, so reopened tickets lose their earlier completion time.
- **Roles as a ranking.** Roles are ordered, and each route declares the minimum rank it needs. Invites are capped below the inviter's own role, so a lead cannot create an owner.
- **Separate frontend and backend deployments.** Vercel serves the frontend and Render runs the API and Socket.io. This requires an exact CORS origin and a cross-site refresh cookie (`SameSite=None; Secure`) in production.
- **Tests run against a real database.** Integration tests use a real MongoDB container, so indexes, unique constraints and query filters are exercised for real.

## Testing and CI/CD

- **Tests:** 25 integration tests covering authentication, tenant isolation and role permissions (Vitest + Supertest).
- **CI** (GitHub Actions, pushes to `main`/`master` and pull requests): backend type-check, tests against a MongoDB service container, and build; frontend lint and build; Docker image builds.
- **CD:** on a push to the default branch, after every CI job passes, GitHub Actions triggers a Render deploy hook. Vercel deployments are handled by the Vercel Git integration when enabled.

## Demo data

To populate the configured database with the public demo accounts and sample
tickets, set `MONGO_URI` to the intended database and run:

```bash
cd backend
MONGO_URI="<your MongoDB connection string>" npm run seed
```

The script is safe to re-run when the demo owner already exists. It creates
accounts with the shared demo password shown above; do not use this seed on a
database containing real user data.

## Run it locally

**With Docker** (starts MongoDB, the API and the frontend):

```bash
docker compose up --build
# open http://localhost:8080
```

**For development** (hot reload):

```bash
# backend/.env
# PORT=5000
# MONGO_URI=mongodb://127.0.0.1:27017/issue-tracker
# JWT_ACCESS_SECRET=change-me
# JWT_REFRESH_SECRET=change-me-too

cd backend && npm install && npm run dev

# frontend/.env
# VITE_API_URL=http://localhost:5000/api
# VITE_SOCKET_URL=http://localhost:5000

cd frontend && npm install && npm run dev
# open http://localhost:5173
```

**Tests:**

```bash
docker run -d --name mongo-test -p 27017:27017 mongo:7
cd backend && npm test
```

## Known limitations and roadmap

Limitations I know about:

- The rate limiter keeps counters in memory, so limits are per server instance. Moving them to Redis is planned.
- Invites only work for people who already have an account, and there is no email verification or password reset.
- Socket events are not rate limited.
- Search does not match partial words or typos.
- Analytics are computed on every request, with no caching yet.
- The free host sleeps when idle, so the first request after a quiet period is slow.

Planned next:

- File attachments on tickets
- Redis for caching and distributed rate limiting
- Admin dashboard
- Internationalization