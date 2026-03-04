#!/bin/sh
set -e

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until mc alias set myminio http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD} 2>/dev/null; do
  echo "Waiting for MinIO..."
  sleep 2
done

echo "MinIO is ready, configuring bucket..."

# Create bucket if it doesn't exist
mc mb myminio/snackspot-photos --ignore-existing

echo "MinIO bucket configured successfully!"
