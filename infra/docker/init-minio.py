#!/usr/bin/env python3
import boto3
import os
import time
from botocore.client import Config

# MinIO configuration
minio_endpoint = 'http://minio:9000'
access_key = os.environ.get('MINIO_ROOT_USER', 'minioadmin')
secret_key = os.environ.get('MINIO_ROOT_PASSWORD', 'minioadmin123')
bucket_name = 'snackspot-photos'

# Wait for MinIO to be ready
print("Waiting for MinIO to be ready...")
s3_client = boto3.client(
    's3',
    endpoint_url=minio_endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version='s3v4'),
    region_name='us-east-1'
)

max_attempts = 30
for attempt in range(max_attempts):
    try:
        s3_client.list_buckets()
        print("MinIO is ready!")
        break
    except Exception as e:
        print(f"Attempt {attempt + 1}/{max_attempts}: MinIO not ready yet...")
        time.sleep(2)
else:
    print("Failed to connect to MinIO")
    exit(1)

# Create bucket if it doesn't exist
try:
    s3_client.head_bucket(Bucket=bucket_name)
    print(f"Bucket {bucket_name} already exists")
except:
    print(f"Creating bucket {bucket_name}...")
    s3_client.create_bucket(Bucket=bucket_name)
    print(f"Bucket {bucket_name} created successfully")

# Set CORS configuration
cors_configuration = {
    'CORSRules': [
        {
            'AllowedHeaders': ['*'],
            'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            'AllowedOrigins': ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080'],
            'ExposeHeaders': ['ETag', 'x-amz-request-id'],
            'MaxAgeSeconds': 3600
        }
    ]
}

print("Setting CORS configuration...")
s3_client.put_bucket_cors(Bucket=bucket_name, CORSConfiguration=cors_configuration)
print("CORS configuration set successfully!")

# Verify CORS configuration
cors = s3_client.get_bucket_cors(Bucket=bucket_name)
print(f"Current CORS configuration: {cors['CORSRules']}")

print("MinIO initialization completed successfully!")
