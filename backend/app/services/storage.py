import asyncio
from io import BytesIO

import boto3
from botocore.config import Config

from app.config import settings


class StorageService:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=f"http{'s' if settings.MINIO_SECURE else ''}://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        self.bucket = settings.MINIO_BUCKET

    async def ensure_bucket(self):
        try:
            await asyncio.to_thread(self.client.head_bucket, Bucket=self.bucket)
        except Exception:
            await asyncio.to_thread(self.client.create_bucket, Bucket=self.bucket)

    async def upload_file(
        self,
        key: str,
        file_obj,
        content_type: str = "application/octet-stream",
    ) -> str:
        if isinstance(file_obj, str):
            with open(file_obj, "rb") as f:
                self.client.upload_file(
                    Filename=file_obj,
                    Bucket=self.bucket,
                    Key=key,
                    ExtraArgs={"ContentType": content_type},
                )
        else:
            if isinstance(file_obj, bytes):
                file_obj = BytesIO(file_obj)
            self.client.upload_fileobj(
                Fileobj=file_obj,
                Bucket=self.bucket,
                Key=key,
                ExtraArgs={"ContentType": content_type},
            )
        return key

    async def upload_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        self.client.upload_fileobj(
            Fileobj=BytesIO(data),
            Bucket=self.bucket,
            Key=key,
            ExtraArgs={"ContentType": content_type},
        )
        return key

    async def get_presigned_url(self, key: str, expires: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires,
        )

    async def download_file(self, key: str, local_path: str) -> str:
        self.client.download_file(self.bucket, key, local_path)
        return local_path

    async def delete_file(self, key: str):
        self.client.delete_object(Bucket=self.bucket, Key=key)

    async def list_files(self, prefix: str) -> list[str]:
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        if "Contents" not in response:
            return []
        return [obj["Key"] for obj in response["Contents"]]


storage_service = StorageService()
