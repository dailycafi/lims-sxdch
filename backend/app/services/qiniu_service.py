from qiniu import Auth, put_data
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class QiniuService:
    def __init__(self):
        self.access_key = settings.QINIU_ACCESS_KEY
        self.secret_key = settings.QINIU_SECRET_KEY
        self.bucket_name = settings.QINIU_BUCKET_NAME
        self.domain = settings.QINIU_BUCKET_DOMAIN
        
        if self.access_key and self.secret_key:
            self.q = Auth(self.access_key, self.secret_key)
        else:
            self.q = None
            logger.warning("Qiniu credentials not found in settings")

    def upload_file(self, file_data: bytes, file_name: str) -> str:
        """
        上传文件到七牛云
        :param file_data: 文件二进制数据
        :param file_name: 文件名（key）
        :return: 文件访问URL
        """
        if not self.q or not self.bucket_name:
            logger.error("Qiniu service not configured properly")
            return ""

        # 生成上传 token
        token = self.q.upload_token(self.bucket_name, file_name, 3600)
        
        # 上传文件
        ret, info = put_data(token, file_name, file_data)
        
        if info.status_code == 200:
            # 构造访问链接
            url = f"{self.domain}/{file_name}"
            # 确保 URL 包含协议头，优先使用 https
            if not url.startswith("http"):
                url = f"https://{url}"
            return url
        else:
            logger.error(f"Failed to upload file to Qiniu: {info.error}")
            return ""

qiniu_service = QiniuService()
