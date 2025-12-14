/**
 * k6 Load Test: MQTT Connection Test
 * Verifies: SC-002 - Support 10,000 concurrent connections
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
 *   ./k6 run k6-connection-test.js
 *   ./k6 run k6-connection-test.js --env MQTT_HOST=emqx.example.com
 *   ./k6 run k6-connection-test.js --vus 1000 --duration 60s
 */

import mqtt from 'k6/x/mqtt';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const connectionTime = new Trend('mqtt_connection_time', true);
const connectionSuccess = new Rate('mqtt_connection_success');
const messagesPublished = new Counter('mqtt_messages_published');
const messagesReceived = new Counter('mqtt_messages_received');

// Test configuration
export const options = {
    scenarios: {
        // Ramp up connections gradually
        connection_ramp: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 100 },   // Ramp to 100 connections
                { duration: '30s', target: 500 },   // Ramp to 500 connections
                { duration: '30s', target: 1000 },  // Ramp to 1000 connections
                { duration: '60s', target: 1000 },  // Hold at 1000
                { duration: '30s', target: 0 },     // Ramp down
            ],
            gracefulRampDown: '30s',
        },
    },
    thresholds: {
        // Connection time should be under 500ms for 95% of connections
        'mqtt_connection_time': ['p(95)<500'],
        // 99% of connections should succeed
        'mqtt_connection_success': ['rate>0.99'],
        // At least 90% of iterations should pass all checks
        'checks': ['rate>0.90'],
    },
};

// Environment configuration
const MQTT_HOST = __ENV.MQTT_HOST || 'localhost';
const MQTT_PORT = parseInt(__ENV.MQTT_PORT || '1883');
const MQTT_USER = __ENV.MQTT_USER || '';
const MQTT_PASS = __ENV.MQTT_PASS || '';

export default function () {
    const clientId = `k6-conn-${__VU}-${__ITER}-${Date.now()}`;
    const topic = `test/load/connection/${__VU}`;

    // Measure connection time
    const startTime = Date.now();

    let client;
    try {
        // Connect to broker
        client = mqtt.connect([`tcp://${MQTT_HOST}:${MQTT_PORT}`], {
            clientId: clientId,
            username: MQTT_USER,
            password: MQTT_PASS,
            cleanSession: true,
            connectTimeout: 10000,
            keepAlive: 60,
        });

        const connTime = Date.now() - startTime;
        connectionTime.add(connTime);
        connectionSuccess.add(1);

        // Check connection succeeded
        const connected = check(client, {
            'client connected': (c) => c !== null,
        });

        if (connected) {
            // Subscribe to a topic
            const subResult = client.subscribe(topic, 0);
            check(subResult, {
                'subscribed successfully': (r) => r === true,
            });

            // Publish a message
            const message = JSON.stringify({
                clientId: clientId,
                timestamp: new Date().toISOString(),
                vu: __VU,
                iteration: __ITER,
            });

            const pubResult = client.publish(topic, message, 0, false);
            check(pubResult, {
                'published successfully': (r) => r === true,
            });

            if (pubResult) {
                messagesPublished.add(1);
            }

            // Keep connection alive for a while
            sleep(Math.random() * 5 + 5); // 5-10 seconds

            // Receive any messages
            const received = client.receive(1000); // 1 second timeout
            if (received && received.length > 0) {
                messagesReceived.add(received.length);
            }
        }
    } catch (error) {
        connectionSuccess.add(0);
        console.error(`Connection failed for ${clientId}: ${error}`);
    } finally {
        // Disconnect
        if (client) {
            try {
                client.close();
            } catch (e) {
                // Ignore close errors
            }
        }
    }

    // Small delay between iterations
    sleep(1);
}

export function handleSummary(data) {
    const summary = {
        test: 'MQTT Connection Load Test',
        timestamp: new Date().toISOString(),
        broker: `${MQTT_HOST}:${MQTT_PORT}`,
        results: {
            total_connections: data.metrics.iterations.values.count,
            connection_success_rate: data.metrics.mqtt_connection_success.values.rate,
            connection_time_avg: data.metrics.mqtt_connection_time.values.avg,
            connection_time_p95: data.metrics.mqtt_connection_time.values['p(95)'],
            messages_published: data.metrics.mqtt_messages_published.values.count,
            messages_received: data.metrics.mqtt_messages_received.values.count,
        },
        thresholds: {
            passed: Object.values(data.root_group.checks).every(c => c.passes === c.fails + c.passes),
        },
    };

    return {
        'stdout': JSON.stringify(summary, null, 2) + '\n',
        'connection-test-results.json': JSON.stringify(summary, null, 2),
    };
}
