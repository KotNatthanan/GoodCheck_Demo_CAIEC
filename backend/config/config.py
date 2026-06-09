import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DEFAULT_PRODUCT_UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'products')
DEFAULT_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///goodcheck.db')


def _jwt_access_token_expires():
    """Read JWT expiry as seconds so .env, docs, and code use one convention."""
    try:
        return timedelta(seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 2592000)))
    except (TypeError, ValueError):
        return timedelta(days=30)

class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-me')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-jwt-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = _jwt_access_token_expires()
    GOODCHECK_ADMIN_EMAIL = os.getenv('GOODCHECK_ADMIN_EMAIL', 'admin@goodcheck.io')
    GOODCHECK_ADMIN_USERNAME = os.getenv('GOODCHECK_ADMIN_USERNAME', 'admin')
    GOODCHECK_ADMIN_PASSWORD = os.getenv('GOODCHECK_ADMIN_PASSWORD', 'Admin123!')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 50 * 1024 * 1024))
    PRODUCT_UPLOAD_FOLDER = os.getenv('PRODUCT_UPLOAD_FOLDER', DEFAULT_PRODUCT_UPLOAD_FOLDER)
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = DEFAULT_DATABASE_URI

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = DEFAULT_DATABASE_URI

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
