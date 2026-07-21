// NovaLabs Load Test Suite using k6
// Tests: /login, /bookings, /payments/*
// Target: p95 < 800ms at 200 RPS sustained

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const bookingDuration = new Trend('booking_duration');
const paymentDuration = new Trend('payment_duration');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

// Test configuration
export const options = {
  scenarios: {
    login: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 100,
      exec: 'loginFlow',
    },
    bookings: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 200,
      exec: 'bookingFlow',
    },
    payments: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 100,
      exec: 'paymentFlow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    errors: ['rate<0.1'],
  },
};

// Helper function to generate random user ID
function randomUserId() {
  return `user_${Math.floor(Math.random() * 10000)}`;
}

// Helper function to generate random workspace ID
function randomWorkspaceId() {
  const workspaces = ['ws_1', 'ws_2', 'ws_3', 'ws_4', 'ws_5'];
  return workspaces[Math.floor(Math.random() * workspaces.length)];
}

// Login Flow
export function loginFlow() {
  const userId = randomUserId();
  
  const payload = JSON.stringify({
    user_id: userId,
    password: 'test_password_123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  const duration = Date.now() - startTime;

  check(res, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 800ms': (r) => r.timings.duration < 800,
    'login returns token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);

  // Simulate user session
  sleep(Math.random() * 2 + 1);
}

// Booking Flow
export function bookingFlow() {
  const userId = randomUserId();
  const workspaceId = randomWorkspaceId();
  
  // First, login to get token
  const loginPayload = JSON.stringify({
    user_id: userId,
    password: 'test_password_123',
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, loginParams);
  
  let token = '';
  try {
    const loginBody = JSON.parse(loginRes.body);
    token = loginBody.token || '';
  } catch (e) {
    // Continue without token for test
  }

  // Check workspace availability
  const startTime = Date.now();
  const availRes = http.get(
    `${BASE_URL}/api/workspaces/${workspaceId}/availability`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      tags: { name: 'check_availability' },
    }
  );

  check(availRes, {
    'availability check status is 200': (r) => r.status === 200,
    'availability check time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  // Create booking
  const now = Math.floor(Date.now() / 1000);
  const bookingPayload = JSON.stringify({
    workspace_id: workspaceId,
    start_time: now + 3600, // 1 hour from now
    end_time: now + 7200,   // 2 hours from now
    user_id: userId,
  });

  const bookingRes = http.post(`${BASE_URL}/api/bookings`, bookingPayload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'create_booking' },
  });

  const bookingDurationMs = Date.now() - startTime;
  bookingDuration.add(bookingDurationMs);

  check(bookingRes, {
    'booking status is 201': (r) => r.status === 201,
    'booking response time < 800ms': (r) => r.timings.duration < 800,
    'booking returns booking_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.booking_id !== undefined;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);

  // Simulate user browsing
  sleep(Math.random() * 3 + 1);
}

// Payment Flow
export function paymentFlow() {
  const userId = randomUserId();
  
  // Login
  const loginPayload = JSON.stringify({
    user_id: userId,
    password: 'test_password_123',
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  let token = '';
  try {
    const loginBody = JSON.parse(loginRes.body);
    token = loginBody.token || '';
  } catch (e) {
    // Continue without token
  }

  // Create payment
  const startTime = Date.now();
  const paymentPayload = JSON.stringify({
    amount: Math.floor(Math.random() * 10000) + 1000, // 10-110 USD in cents
    currency: 'USD',
    description: 'Workspace booking payment',
    booking_id: `booking_${Date.now()}`,
  });

  const paymentRes = http.post(`${BASE_URL}/api/payments`, paymentPayload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'create_payment' },
  });

  const paymentDurationMs = Date.now() - startTime;
  paymentDuration.add(paymentDurationMs);

  check(paymentRes, {
    'payment status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'payment response time < 800ms': (r) => r.timings.duration < 800,
    'payment returns transaction_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.transaction_id !== undefined;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);

  // Simulate processing time
  sleep(Math.random() * 2 + 1);
}

// Summary handler
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      http_req_duration: data.metrics.http_req_duration?.values,
      errors: data.metrics.errors?.values,
      booking_duration: data.metrics.booking_duration?.values,
      payment_duration: data.metrics.payment_duration?.values,
    },
    thresholds: data.thresholds,
  };

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'tests/load/summary.json': JSON.stringify(summary, null, 2),
  };
}
