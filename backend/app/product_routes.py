"""
Product CRUD routes — /api/products
"""
import os
from uuid import uuid4

from flask import Blueprint, request, jsonify, current_app, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.models import db, Product, SellerReview, User
from app.validators import validate_product_data
from app.errors import validation_error, not_found_error, unauthorized_error, success_response
from app.permissions import get_current_active_user
from app.constants import DEFAULT_LOCATIONS, PRODUCT_CATEGORIES
from sqlalchemy import and_, or_

products_bp = Blueprint('products', __name__, url_prefix='/api/products')


def _is_allowed_image(filename):
    if not filename or '.' not in filename:
        return False

    extension = filename.rsplit('.', 1)[1].lower()
    return extension in current_app.config['ALLOWED_IMAGE_EXTENSIONS']


def _build_saved_image_name(filename, user_id):
    original_name = secure_filename(filename) or 'listing-image.jpg'
    extension = os.path.splitext(original_name)[1].lower() or '.jpg'
    return f'{user_id}-{uuid4().hex}{extension}'


def _normalize_image_payload(data, fallback_image_url='', fallback_image_urls=None):
    fallback_image_urls = fallback_image_urls or []
    raw_images = data.get('image_urls', fallback_image_urls)

    if isinstance(raw_images, str):
        raw_images = [raw_images]

    if not isinstance(raw_images, list):
        raw_images = fallback_image_urls

    normalized = [str(url).strip() for url in raw_images if str(url).strip()]

    explicit_cover = str(data.get('image_url') or '').strip()
    fallback_cover = str(fallback_image_url or '').strip()
    cover_image = explicit_cover or (normalized[0] if normalized else fallback_cover)

    if cover_image:
        normalized = [url for url in normalized if url != cover_image]
        normalized.insert(0, cover_image)

    return cover_image, normalized[:10]


def _merge_default_options(defaults, rows):
    """Keep curated options first, then append any values already present in data."""
    values = [row[0] for row in rows if row and row[0]]
    extras = sorted(value for value in set(values) if value not in defaults)
    return [*defaults, *extras]


@products_bp.route('/upload-image', methods=['POST'])
@jwt_required()
def upload_product_image():
    """Upload product image files (up to 5) and return public URLs."""
    user, error = get_current_active_user()
    if error:
        return error

    images = request.files.getlist('images')
    if not images or not images[0].filename:
        # Fallback for single image upload backwards compatibility
        single_image = request.files.get('image')
        if single_image and single_image.filename:
            images = [single_image]
        else:
            return validation_error('Please choose at least one image file to upload.')

    if len(images) > 5:
        return validation_error('You can upload a maximum of 5 images per listing.')

    uploaded_data = []

    for image in images:
        if not image.filename:
            continue

        if not _is_allowed_image(image.filename):
            return validation_error(f'File {image.filename} not allowed. Only JPG, PNG, WEBP, GIF permitted.')

        if image.mimetype and not image.mimetype.startswith('image/'):
            return validation_error(f'File {image.filename} must be an image.')

        filename = _build_saved_image_name(image.filename, user.id)
        upload_path = os.path.join(current_app.config['PRODUCT_UPLOAD_FOLDER'], filename)
        image.save(upload_path)

        image_url = url_for('uploaded_file', filename=filename, _external=True)
        uploaded_data.append({
            'image_url': image_url,
            'filename': filename
        })

    if not uploaded_data:
        return validation_error('No valid images were uploaded.')

    return success_response(
        {
            # Backwards compatibility: return the first one as primary
            'image_url': uploaded_data[0]['image_url'],
            'filename': uploaded_data[0]['filename'],
            'uploaded_images': uploaded_data,
            'image_urls': [item['image_url'] for item in uploaded_data]
        },
        message=f'Successfully uploaded {len(uploaded_data)} image(s).',
        status=201,
    )


@products_bp.route('', methods=['GET'])
def get_products():
    """ดึงรายการสินค้า with filtering & pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)
    search = request.args.get('search', '', type=str)
    category = request.args.get('category', '', type=str)
    location = request.args.get('location', '', type=str)
    condition = request.args.get('condition', '', type=str)
    price_min = request.args.get('price_min', 0, type=int)
    price_max = request.args.get('price_max', 999999999, type=int)
    sort_by = request.args.get('sort_by', 'created_at', type=str)
    sort_order = request.args.get('sort_order', 'desc', type=str)

    query = Product.query.join(User, Product.seller_id == User.id).filter(
        Product.status == 'available',
        Product.moderation_status == 'approved',
        User.account_status == 'active',
    )

    if search:
        query = query.filter(
            or_(
                Product.title.ilike(f'%{search}%'),
                Product.description.ilike(f'%{search}%')
            )
        )

    if category:
        query = query.filter(Product.category == category)
    if location:
        query = query.filter(Product.location == location)
    if condition:
        query = query.filter(Product.condition == condition)

    query = query.filter(and_(Product.price >= price_min, Product.price <= price_max))

    # Sorting
    sort_column = {
        'created_at': Product.created_at,
        'price': Product.price,
        'rating': Product.rating,
    }.get(sort_by, Product.created_at)

    query = query.order_by(sort_column.desc() if sort_order == 'desc' else sort_column.asc())

    paginate = query.paginate(page=page, per_page=per_page)
    products = [p.to_dict() for p in paginate.items]

    return jsonify({
        'products': products,
        'total': paginate.total,
        'pages': paginate.pages,
        'current_page': page,
        'per_page': per_page
    }), 200


@products_bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """ดึงรายละเอียดสินค้า"""
    product = Product.query.join(User, Product.seller_id == User.id).filter(
        Product.id == product_id,
        Product.moderation_status == 'approved',
        User.account_status == 'active',
    ).first()
    if not product:
        return not_found_error('Product')

    product.views += 1
    db.session.commit()

    product_data = product.to_dict()
    product_data['reviews'] = [review.to_dict() for review in product.reviews]
    product_data['seller_reviews'] = [
        review.to_dict()
        for review in SellerReview.query
        .filter_by(seller_id=product.seller_id)
        .order_by(SellerReview.created_at.desc())
        .limit(4)
        .all()
    ]
    return jsonify(product_data), 200


@products_bp.route('', methods=['POST'])
@jwt_required()
def create_product():
    """สร้างประกาศสินค้าใหม่"""
    user, error = get_current_active_user()
    if error:
        return error

    data = request.get_json()
    is_valid, error_msg = validate_product_data(data)
    if not is_valid:
        return validation_error(error_msg)

    cover_image, image_urls = _normalize_image_payload(data)

    product = Product(
        title=data['title'],
        description=data.get('description', ''),
        category=data['category'],
        price=data['price'],
        condition=data.get('condition', 'Good condition'),
        location=data.get('location', user.location or ''),
        warranty=data.get('warranty', ''),
        specs=data.get('specs', []),
        image_url=cover_image,
        image_urls=image_urls,
        seller_id=user.id,
        moderation_status='pending',
    )

    db.session.add(product)
    db.session.commit()

    return success_response(
        {'product': product.to_dict()},
        message='Product listing submitted for admin review successfully.',
        status=201
    )


@products_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    """อัปเดตประกาศสินค้า"""
    user, error = get_current_active_user()
    if error:
        return error

    product = Product.query.get(product_id)

    if not product:
        return not_found_error('Product')
    if product.seller_id != user.id:
        return unauthorized_error('You do not own this product.')

    data = request.get_json()
    is_valid, error_msg = validate_product_data(data, required=False)
    if not is_valid:
        return validation_error(error_msg)

    updatable_fields = ['title', 'description', 'price', 'condition',
                        'location', 'warranty', 'specs', 'status']
    for field in updatable_fields:
        if field in data:
            setattr(product, field, data[field])

    if 'image_url' in data or 'image_urls' in data:
        cover_image, image_urls = _normalize_image_payload(
            data,
            fallback_image_url=product.image_url,
            fallback_image_urls=product.normalized_image_urls(),
        )
        product.image_url = cover_image
        product.image_urls = image_urls

    product.moderation_status = 'pending'
    product.moderation_note = ''
    product.reviewed_at = None
    product.reviewed_by = None

    db.session.commit()

    return success_response(
        {'product': product.to_dict()},
        message='Product updated and resubmitted for admin review.'
    )


@products_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    """ลบประกาศสินค้า"""
    user, error = get_current_active_user()
    if error:
        return error

    product = Product.query.get(product_id)

    if not product:
        return not_found_error('Product')
    if product.seller_id != user.id:
        return unauthorized_error('You do not own this product.')

    db.session.delete(product)
    db.session.commit()

    return jsonify({'message': 'Product deleted successfully.'}), 200


@products_bp.route('/seller/<int:seller_id>', methods=['GET'])
def get_seller_products(seller_id):
    """ดึงสินค้าของผู้ขาย"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)

    query = Product.query.join(User, Product.seller_id == User.id).filter(
        Product.seller_id == seller_id,
        Product.status == 'available',
        Product.moderation_status == 'approved',
        User.account_status == 'active',
    )
    paginate = query.paginate(page=page, per_page=per_page)
    products = [p.to_dict() for p in paginate.items]

    return jsonify({
        'products': products,
        'total': paginate.total,
        'pages': paginate.pages
    }), 200


@products_bp.route('/my-listings', methods=['GET'])
@jwt_required()
def get_my_listings():
    """Return the authenticated seller's listings, including pending moderation states."""
    user, error = get_current_active_user()
    if error:
        return error

    moderation_status = request.args.get('moderation_status', '', type=str)
    limit = request.args.get('limit', 50, type=int)

    query = Product.query.filter(Product.seller_id == user.id)

    if moderation_status and moderation_status != 'all':
        query = query.filter(Product.moderation_status == moderation_status)

    products = query.order_by(Product.updated_at.desc(), Product.created_at.desc()).limit(limit).all()

    totals = {
        'all': Product.query.filter(Product.seller_id == user.id).count(),
        'pending': Product.query.filter(
            Product.seller_id == user.id,
            Product.moderation_status == 'pending',
        ).count(),
        'approved': Product.query.filter(
            Product.seller_id == user.id,
            Product.moderation_status == 'approved',
        ).count(),
        'rejected': Product.query.filter(
            Product.seller_id == user.id,
            Product.moderation_status == 'rejected',
        ).count(),
        'hidden': Product.query.filter(
            Product.seller_id == user.id,
            Product.moderation_status == 'hidden',
        ).count(),
    }

    return jsonify({
        'products': [product.to_dict(admin_view=True) for product in products],
        'total': len(products),
        'totals': totals,
    }), 200


@products_bp.route('/categories', methods=['GET'])
def get_categories():
    """ดึงรายการหมวดหมู่ที่มีสินค้า"""
    categories = db.session.query(Product.category).join(User, Product.seller_id == User.id).distinct().filter(
        Product.status == 'available',
        Product.moderation_status == 'approved',
        User.account_status == 'active',
    ).all()
    return jsonify({'categories': _merge_default_options(PRODUCT_CATEGORIES, categories)}), 200


@products_bp.route('/locations', methods=['GET'])
def get_locations():
    """ดึงรายการจังหวัดที่มีสินค้า"""
    locations = db.session.query(Product.location).join(User, Product.seller_id == User.id).distinct().filter(
        Product.status == 'available',
        Product.moderation_status == 'approved',
        User.account_status == 'active',
    ).all()
    return jsonify({'locations': _merge_default_options(DEFAULT_LOCATIONS, locations)}), 200
