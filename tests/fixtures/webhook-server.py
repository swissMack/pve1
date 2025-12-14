#!/usr/bin/env python3
"""
Mock Webhook Server for MQTT Integration Testing

A simple HTTP server that receives webhook requests from EMQX rules engine
and logs them for test verification.

Usage:
    python webhook-server.py [--port PORT] [--host HOST]

Endpoints:
    POST /api/mqtt/events  - Receive MQTT events
    POST /api/alerts       - Receive alert events
    GET  /health           - Health check endpoint
    GET  /logs             - Get received webhook logs
    DELETE /logs           - Clear webhook logs
    POST /config           - Configure server behavior (delays, failures)
"""

import argparse
import json
import logging
import threading
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# In-memory storage for webhook logs
webhook_logs = []
logs_lock = threading.Lock()

# Server configuration
server_config = {
    'fail_next': 0,  # Number of next requests to fail
    'delay_ms': 0,   # Delay before responding (ms)
}
config_lock = threading.Lock()


class WebhookHandler(BaseHTTPRequestHandler):
    """HTTP request handler for webhook endpoints."""

    def log_message(self, format, *args):
        """Override to use our logger."""
        logger.info("%s - %s", self.address_string(), format % args)

    def send_json_response(self, status_code, data):
        """Send a JSON response."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query = parse_qs(parsed_path.query)

        if path == '/health':
            self.send_json_response(200, {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat()
            })

        elif path == '/logs':
            with logs_lock:
                if 'count' in query:
                    self.send_json_response(200, {'count': len(webhook_logs)})
                elif 'include_headers' in query:
                    self.send_json_response(200, webhook_logs)
                else:
                    # Return just payloads
                    payloads = [log.get('body', {}) for log in webhook_logs]
                    self.send_json_response(200, payloads)

        elif path == '/config':
            with config_lock:
                self.send_json_response(200, server_config)

        else:
            self.send_json_response(404, {'error': 'Not found'})

    def do_POST(self):
        """Handle POST requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ''

        # Parse JSON body
        try:
            json_body = json.loads(body) if body else {}
        except json.JSONDecodeError:
            json_body = {'raw': body}

        # Handle config endpoint
        if path == '/config':
            with config_lock:
                server_config.update(json_body)
            self.send_json_response(200, {'status': 'updated', 'config': server_config})
            return

        # Check if we should simulate failure
        with config_lock:
            if server_config['fail_next'] > 0:
                server_config['fail_next'] -= 1
                logger.warning("Simulating failure (remaining: %d)", server_config['fail_next'])
                self.send_json_response(500, {'error': 'Simulated failure'})
                return

            # Apply configured delay
            if server_config['delay_ms'] > 0:
                time.sleep(server_config['delay_ms'] / 1000)

        # Handle webhook endpoints
        if path in ['/api/mqtt/events', '/api/alerts', '/webhook']:
            # Log the webhook
            log_entry = {
                'timestamp': datetime.utcnow().isoformat(),
                'path': path,
                'method': 'POST',
                'headers': dict(self.headers),
                'body': json_body
            }

            with logs_lock:
                webhook_logs.append(log_entry)

            logger.info("Received webhook: %s - %s", path, json.dumps(json_body)[:200])

            self.send_json_response(200, {
                'status': 'received',
                'id': len(webhook_logs),
                'timestamp': datetime.utcnow().isoformat()
            })

        else:
            self.send_json_response(404, {'error': 'Not found'})

    def do_DELETE(self):
        """Handle DELETE requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/logs':
            with logs_lock:
                count = len(webhook_logs)
                webhook_logs.clear()
            self.send_json_response(200, {'status': 'cleared', 'count': count})

        else:
            self.send_json_response(404, {'error': 'Not found'})


def run_server(host='0.0.0.0', port=8080):
    """Run the webhook server."""
    server_address = (host, port)
    httpd = HTTPServer(server_address, WebhookHandler)

    logger.info("Starting webhook server on %s:%d", host, port)
    logger.info("Endpoints:")
    logger.info("  POST /api/mqtt/events  - Receive MQTT events")
    logger.info("  POST /api/alerts       - Receive alerts")
    logger.info("  GET  /health           - Health check")
    logger.info("  GET  /logs             - Get webhook logs")
    logger.info("  DELETE /logs           - Clear logs")
    logger.info("  POST /config           - Configure server")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down webhook server")
        httpd.shutdown()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Mock Webhook Server for MQTT Testing')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8080, help='Port to listen on (default: 8080)')
    args = parser.parse_args()

    run_server(host=args.host, port=args.port)
