import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const ORG_ID = __ENV.ORG_ID;
const TICKET_ID = __ENV.TICKET_ID;
const EMAIL = __ENV.EMAIL || "loadtest@example.com";
const PASSWORD = __ENV.PASSWORD || "loadtest-password";

export const options = {
  scenarios: {
    readers: { executor: "constant-vus", vus: 20, duration: "30s", exec: "readAnalytics" },
    writer: {
      executor: "constant-arrival-rate",
      rate: 1,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 1,
      exec: "moveTicket",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:analytics}": ["p(95)<5000"],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, { "logged in": (r) => r.status === 200 });
  return { token: res.json("accessToken") };
}

export function readAnalytics(data) {
  const res = http.get(`${BASE_URL}/api/orgs/${ORG_ID}/analytics`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { endpoint: "analytics" },
  });
  check(res, { "analytics 200": (r) => r.status === 200 });
}

export function moveTicket(data) {
  const status = __ITER % 2 === 0 ? "in_progress" : "review";
  const res = http.patch(
    `${BASE_URL}/api/orgs/${ORG_ID}/tickets/${TICKET_ID}`,
    JSON.stringify({ status }),
    {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
      tags: { endpoint: "move" },
    }
  );
  check(res, { "move 200": (r) => r.status === 200 });
}