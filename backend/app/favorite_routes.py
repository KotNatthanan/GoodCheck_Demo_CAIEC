"""
Favorite routes — /api/favorites
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, Favorite, Product
from app.errors import not_found_error
from app.permissions import get_current_active_user

favorites_bp = Blueprint('favorites', __name__, url_prefix='/api/favorites')


@favorites_bp.route('', methods=['GET'])
@jwt_required()
def get_favorites():
    """ดึงรายการสินค้าโปรดของผู้ใช้"""
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id
    favs = Favorite.query.filter_by(user_id=user_id).order_by(Favorite.created_at.desc()).all()

    products = []
    for fav in favs:
        product = Product.query.get(fav.product_id)
        if product:
            products.append(product.to_dict())

    return jsonify({
        'favorites': products,
        'total': len(products)
    }), 200


@favorites_bp.route('/<int:product_id>', methods=['POST'])
@jwt_required()
def add_favorite(product_id):
    """เพิ่มสินค้าเข้ารายการโปรด"""
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id

    product = Product.query.get(product_id)
    if not product or product.moderation_status != 'approved':
        return not_found_error('Product')

    existing = Favorite.query.filter_by(
        user_id=user_id,
        product_id=product_id
    ).first()

    if existing:
        return jsonify({'message': 'This product is already in your favorites.'}), 200

    fav = Favorite(user_id=user_id, product_id=product_id)
    db.session.add(fav)
    db.session.commit()

    return jsonify({'message': 'Added to favorites.'}), 201


@favorites_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite(product_id):
    """ลบสินค้าออกจากรายการโปรด"""
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id

    fav = Favorite.query.filter_by(
        user_id=user_id,
        product_id=product_id
    ).first()

    if not fav:
        return not_found_error('Favorite item')

    db.session.delete(fav)
    db.session.commit()

    return jsonify({'message': 'Removed from favorites.'}), 200


@favorites_bp.route('/ids', methods=['GET'])
@jwt_required()
def get_favorite_ids():
    """ดึง product_id ทั้งหมดที่อยู่ในรายการโปรด (สำหรับ frontend check)"""
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id
    favs = Favorite.query.filter_by(user_id=user_id).all()
    ids = [fav.product_id for fav in favs]

    return jsonify({'favorite_ids': ids}), 200
