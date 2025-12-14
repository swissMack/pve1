#!/bin/bash
# Generate TLS Certificates for MQTT Test Ecosystem
# Creates CA, server, and client certificates
# Usage: ./scripts/generate-certs.sh [output_dir]

set -e

OUTPUT_DIR="${1:-$(pwd)/certs}"
DAYS_VALID=365
KEY_SIZE=2048

# Certificate Subject Information
CA_SUBJECT="/C=US/ST=California/L=San Francisco/O=MQTT Test Ecosystem/OU=Development/CN=MQTT Test CA"
SERVER_SUBJECT="/C=US/ST=California/L=San Francisco/O=MQTT Test Ecosystem/OU=Development/CN=localhost"
CLIENT_SUBJECT="/C=US/ST=California/L=San Francisco/O=MQTT Test Ecosystem/OU=Development/CN=mqtt-client"

echo "=== MQTT Test Ecosystem - Certificate Generation ==="
echo "Output directory: ${OUTPUT_DIR}"
echo "Validity: ${DAYS_VALID} days"
echo ""

# Create output directory
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}/clients"

# Clean up any existing certificates
echo "Cleaning up existing certificates..."
rm -f "${OUTPUT_DIR}"/*.crt "${OUTPUT_DIR}"/*.key "${OUTPUT_DIR}"/*.csr "${OUTPUT_DIR}"/*.srl
rm -f "${OUTPUT_DIR}/clients"/*.crt "${OUTPUT_DIR}/clients"/*.key "${OUTPUT_DIR}/clients"/*.csr

# Generate CA private key
echo "Generating CA private key..."
openssl genrsa -out "${OUTPUT_DIR}/ca.key" ${KEY_SIZE}

# Generate CA certificate
echo "Generating CA certificate..."
openssl req -new -x509 -days ${DAYS_VALID} \
    -key "${OUTPUT_DIR}/ca.key" \
    -out "${OUTPUT_DIR}/ca.crt" \
    -subj "${CA_SUBJECT}"

# Generate server private key
echo "Generating server private key..."
openssl genrsa -out "${OUTPUT_DIR}/server.key" ${KEY_SIZE}

# Generate server certificate signing request
echo "Generating server CSR..."
openssl req -new \
    -key "${OUTPUT_DIR}/server.key" \
    -out "${OUTPUT_DIR}/server.csr" \
    -subj "${SERVER_SUBJECT}"

# Create server certificate extensions file
cat > "${OUTPUT_DIR}/server_ext.cnf" << EOF
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = emqx
DNS.3 = mqtt-emqx
DNS.4 = *.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Sign server certificate with CA
echo "Signing server certificate..."
openssl x509 -req -days ${DAYS_VALID} \
    -in "${OUTPUT_DIR}/server.csr" \
    -CA "${OUTPUT_DIR}/ca.crt" \
    -CAkey "${OUTPUT_DIR}/ca.key" \
    -CAcreateserial \
    -out "${OUTPUT_DIR}/server.crt" \
    -extfile "${OUTPUT_DIR}/server_ext.cnf"

# Generate client private key
echo "Generating client private key..."
openssl genrsa -out "${OUTPUT_DIR}/client.key" ${KEY_SIZE}

# Generate client certificate signing request
echo "Generating client CSR..."
openssl req -new \
    -key "${OUTPUT_DIR}/client.key" \
    -out "${OUTPUT_DIR}/client.csr" \
    -subj "${CLIENT_SUBJECT}"

# Create client certificate extensions file
cat > "${OUTPUT_DIR}/client_ext.cnf" << EOF
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

# Sign client certificate with CA
echo "Signing client certificate..."
openssl x509 -req -days ${DAYS_VALID} \
    -in "${OUTPUT_DIR}/client.csr" \
    -CA "${OUTPUT_DIR}/ca.crt" \
    -CAkey "${OUTPUT_DIR}/ca.key" \
    -CAcreateserial \
    -out "${OUTPUT_DIR}/client.crt" \
    -extfile "${OUTPUT_DIR}/client_ext.cnf"

# Generate additional test client certificates
for i in 1 2 3; do
    CLIENT_NAME="client${i}"
    echo "Generating ${CLIENT_NAME} certificate..."

    openssl genrsa -out "${OUTPUT_DIR}/clients/${CLIENT_NAME}.key" ${KEY_SIZE}

    openssl req -new \
        -key "${OUTPUT_DIR}/clients/${CLIENT_NAME}.key" \
        -out "${OUTPUT_DIR}/clients/${CLIENT_NAME}.csr" \
        -subj "/C=US/ST=California/L=San Francisco/O=MQTT Test Ecosystem/OU=Development/CN=${CLIENT_NAME}"

    openssl x509 -req -days ${DAYS_VALID} \
        -in "${OUTPUT_DIR}/clients/${CLIENT_NAME}.csr" \
        -CA "${OUTPUT_DIR}/ca.crt" \
        -CAkey "${OUTPUT_DIR}/ca.key" \
        -CAcreateserial \
        -out "${OUTPUT_DIR}/clients/${CLIENT_NAME}.crt" \
        -extfile "${OUTPUT_DIR}/client_ext.cnf"

    rm -f "${OUTPUT_DIR}/clients/${CLIENT_NAME}.csr"
done

# Clean up temporary files
rm -f "${OUTPUT_DIR}"/*.csr "${OUTPUT_DIR}"/*.cnf "${OUTPUT_DIR}"/*.srl

# Set permissions
chmod 600 "${OUTPUT_DIR}"/*.key
chmod 600 "${OUTPUT_DIR}/clients"/*.key
chmod 644 "${OUTPUT_DIR}"/*.crt
chmod 644 "${OUTPUT_DIR}/clients"/*.crt

# Verify certificates
echo ""
echo "=== Verifying Certificates ==="

echo -n "CA certificate: "
openssl x509 -in "${OUTPUT_DIR}/ca.crt" -noout -subject | cut -d= -f2-

echo -n "Server certificate: "
openssl x509 -in "${OUTPUT_DIR}/server.crt" -noout -subject | cut -d= -f2-

echo -n "Client certificate: "
openssl x509 -in "${OUTPUT_DIR}/client.crt" -noout -subject | cut -d= -f2-

echo ""
echo "Verifying certificate chain..."
openssl verify -CAfile "${OUTPUT_DIR}/ca.crt" "${OUTPUT_DIR}/server.crt"
openssl verify -CAfile "${OUTPUT_DIR}/ca.crt" "${OUTPUT_DIR}/client.crt"

# List generated files
echo ""
echo "=== Generated Files ==="
ls -la "${OUTPUT_DIR}"/
echo ""
ls -la "${OUTPUT_DIR}/clients"/

echo ""
echo "=== Certificate Generation Complete ==="
echo ""
echo "Files created in: ${OUTPUT_DIR}"
echo ""
echo "Usage:"
echo "  CA Certificate:     ${OUTPUT_DIR}/ca.crt"
echo "  Server Certificate: ${OUTPUT_DIR}/server.crt"
echo "  Server Key:         ${OUTPUT_DIR}/server.key"
echo "  Client Certificate: ${OUTPUT_DIR}/client.crt"
echo "  Client Key:         ${OUTPUT_DIR}/client.key"
echo ""
echo "For Docker, mount certificates to /opt/emqx/etc/certs/"
echo ""
