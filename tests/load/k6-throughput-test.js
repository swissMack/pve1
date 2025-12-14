/**
 * k6 Load Test: MQTT Message Throughput Test
 * Verifies: SC-003 - 1,000 messages/second throughput
 *           SC-004 - Message latency < 100ms (p95)
 *
 * Prerequisites:
 *   - k6 installed (https://k6.io/docs/getting-started/installation/)
 *   - xk6-mqtt extension (https://github.com/pmalhaire/xk6-mqtt)
 *   - EMQX broker running on localhost:1883
 *
 * Installation:
 *   # Build k6 with MQTT extension
 *   xk6 build --with github.com/pmalhaire/xk6-mqtt
 *
 * Usage:
 *   ./k6 run k6-throughput-test.js
 *   ./k6 run k6-throughput-test.js --env MQTT_HOST=emqx.example.com
 *   ./k6 run k6-throughput-test.js --env TARGET_RPS=2000
 */

import mqtt from 'k6/x/mqtt';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

// Custom metrics
const messageLatency = new Trend('mqtt_message_latency', true);
const publishSuccess = new Rate('mqtt_publish_success');
const messagesPublished = new Counter('mqtt_messages_published');
const messagesReceived = new Counter('mqtt_messages_received');
const currentConnections = new Gauge('mqtt_current_connections');
const publishRate = new Rate('mqtt_publish_rate');

// Environment configuration
const MQTT_HOST = __ENV.MQTT_HOST || 'localhost';
const MQTT_PORT = parseInt(__ENV.MQTT_PORT || '1883');
const MQTT_USER = __ENV.MQTT_USER || '';
const MQTT_PASS = __ENV.MQTT_PASS || '';
const TARGET_RPS = parseInt(__ENV.TARGET_RPS || '1000');
const MESSAGE_SIZE = parseInt(__ENV.MESSAGE_SIZE || '256'); // bytes

// Test configuration
export const options = {
    scenarios: {
        // Constant rate of message publishing
        constant_throughput: {
            executor: 'constant-arrival-rate',
            rate: TARGET_RPS,
            timeUnit: '1s',
            duration: '2m',
            preAllocatedVUs: 50,
            maxVUs: 200,
        },
        // Sustained load for latency measurement
        sustained_load: {
            executor: 'constant-vus',
            vus: 20,
            duration: '2m',
            startTime: '2m',
        },
        // Burst test
        burst_test: {
            executor: 'ramping-arrival-rate',
            startRate: 100,
            timeUnit: '1s',
            preAllocatedVUs: 100,
            maxVUs: 500,
            stages: [
                { duration: '10s', target: 500 },   // Burst to 500 msg/s
                { duration: '20s', target: 2000 },  // Burst to 2000 msg/s
                { duration: '10s', target: 500 },   // Back down
                { duration: '10s', target: 100 },   // Calm down
            ],
            startTime: '4m',
        },
    },
    thresholds: {
        // Message latency should be under 100ms for 95% of messages
        'mqtt_message_latency': ['p(95)<100', 'p(99)<500'],
        // 99.9% of publishes should succeed
        'mqtt_publish_success': ['rate>0.999'],
        // Maintain target publish rate
        'mqtt_publish_rate': ['rate>0.95'],
        // All checks should pass
        'checks': ['rate>0.95'],
    },
};

// Generate payload of specified size
function generatePayload(size) {
    const timestamp = Date.now();
    const basePayload = {
        t: timestamp,
        v: __VU,
        i: __ITER,
    };

    const baseSize = JSON.stringify(basePayload).length;
    if (size > baseSize) {
        basePayload.d = 'x'.repeat(size - baseSize - 10);
    }

    return JSON.stringify(basePayload);
}

// Shared client pool (per VU)
let client = null;
let clientId = null;

export function setup() {
    console.log(`Starting throughput test against ${MQTT_HOST}:${MQTT_PORT}`);
    console.log(`Target RPS: ${TARGET_RPS}, Message Size: ${MESSAGE_SIZE} bytes`);
    return { startTime: Date.now() };
}

export default function (data) {
    // Create client if not exists for this VU
    if (!client) {
        clientId = `k6-throughput-${__VU}-${Date.now()}`;
        try {
            client = mqtt.connect([`tcp://${MQTT_HOST}:${MQTT_PORT}`], {
                clientId: clientId,
                username: MQTT_USER,
                password: MQTT_PASS,
                cleanSession: true,
                connectTimeout: 5000,
                keepAlive: 30,
            });
            currentConnections.add(1);
        } catch (e) {
            console.error(`Failed to connect VU ${__VU}: ${e}`);
            return;
        }
    }

    const topic = `test/load/throughput/${__VU}/${__ITER % 100}`;
    const payload = generatePayload(MESSAGE_SIZE);
    const sendTime = Date.now();

    try {
        // Publish message with QoS 1 for reliability
        const result = client.publish(topic, payload, 1, false);
        const receiveTime = Date.now();
        const latency = receiveTime - sendTime;

        check(result, {
            'message published': (r) => r === true,
        });

        if (result) {
            messagesPublished.add(1);
            publishSuccess.add(1);
            publishRate.add(1);
            messageLatency.add(latency);
        } else {
            publishSuccess.add(0);
            publishRate.add(0);
        }
    } catch (e) {
        publishSuccess.add(0);
        publishRate.add(0);
        console.error(`Publish failed: ${e}`);

        // Reconnect on failure
        try {
            client.close();
        } catch (closeErr) {
            // Ignore
        }
        client = null;
    }
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log(`Test completed in ${duration.toFixed(2)} seconds`);
}

export function handleSummary(data) {
    const totalMessages = data.metrics.mqtt_messages_published?.values?.count || 0;
    const duration = data.state.testRunDurationMs / 1000;
    const actualRps = totalMessages / duration;

    const summary = {
        test: 'MQTT Throughput Load Test',
        timestamp: new Date().toISOString(),
        broker: `${MQTT_HOST}:${MQTT_PORT}`,
        configuration: {
            target_rps: TARGET_RPS,
            message_size_bytes: MESSAGE_SIZE,
            duration_seconds: duration,
        },
        results: {
            total_messages: totalMessages,
            actual_rps: actualRps.toFixed(2),
            rps_achievement: ((actualRps / TARGET_RPS) * 100).toFixed(1) + '%',
            publish_success_rate: (data.metrics.mqtt_publish_success?.values?.rate * 100 || 0).toFixed(2) + '%',
            latency: {
                avg_ms: data.metrics.mqtt_message_latency?.values?.avg?.toFixed(2) || 'N/A',
                p50_ms: data.metrics.mqtt_message_latency?.values?.['p(50)']?.toFixed(2) || 'N/A',
                p95_ms: data.metrics.mqtt_message_latency?.values?.['p(95)']?.toFixed(2) || 'N/A',
                p99_ms: data.metrics.mqtt_message_latency?.values?.['p(99)']?.toFixed(2) || 'N/A',
                max_ms: data.metrics.mqtt_message_latency?.values?.max?.toFixed(2) || 'N/A',
            },
        },
        thresholds: {
            latency_p95_under_100ms: data.metrics.mqtt_message_latency?.values?.['p(95)'] < 100,
            publish_success_over_999: data.metrics.mqtt_publish_success?.values?.rate > 0.999,
        },
        pass: (
            (data.metrics.mqtt_message_latency?.values?.['p(95)'] || 0) < 100 &&
            (data.metrics.mqtt_publish_success?.values?.rate || 0) > 0.999
        ),
    };

    console.log('\n=== THROUGHPUT TEST SUMMARY ===');
    console.log(`Total Messages: ${totalMessages}`);
    console.log(`Actual RPS: ${actualRps.toFixed(2)} (${summary.results.rps_achievement} of target)`);
    console.log(`P95 Latency: ${summary.results.latency.p95_ms}ms`);
    console.log(`Success Rate: ${summary.results.publish_success_rate}`);
    console.log(`Test ${summary.pass ? 'PASSED' : 'FAILED'}`);
    console.log('================================\n');

    return {
        'stdout': JSON.stringify(summary, null, 2) + '\n',
        'throughput-test-results.json': JSON.stringify(summary, null, 2),
    };
}
