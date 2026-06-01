from flask import Flask, send_from_directory
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from app.models import db
from app.auth import auth_bp
from app.product_routes import products_bp
from app.review_routes import reviews_bp
from app.favorite_routes import favorites_bp
from app.order_routes import orders_bp
from app.claim_routes import claims_bp
from app.chat_routes import chats_bp
from app.admin_routes import admin_bp
from app.seller_review_routes import seller_reviews_bp
from app.image_comparing import compare_bp
from app.errors import register_error_handlers
from app.runtime_setup import ensure_default_admin, ensure_runtime_schema
import os

def create_app(config_name='development'):
    # Resolve UI1 directory path
    ui_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'UI1')
    ui_dir = os.path.abspath(ui_dir)

    app = Flask(__name__, static_folder=ui_dir, static_url_path='')

    # Load configuration
    from config.config import config
    app.config.from_object(config[config_name])
    os.makedirs(app.config['PRODUCT_UPLOAD_FOLDER'], exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(favorites_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(claims_bp)
    app.register_blueprint(chats_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(seller_reviews_bp)

    app.register_blueprint(compare_bp, url_prefix="/api")

    # Register error handlers
    register_error_handlers(app)

    # Create tables
    with app.app_context():
        db.create_all()
        ensure_runtime_schema()
        ensure_default_admin(app)

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health():
        return {'status': 'ok'}, 200

    @app.route('/uploads/<path:filename>', methods=['GET'])
    def uploaded_file(filename):
        return send_from_directory(app.config['PRODUCT_UPLOAD_FOLDER'], filename)

    # Serve frontend
    @app.route('/')
    def index():
        return send_from_directory(ui_dir, 'index.html')

    return app
