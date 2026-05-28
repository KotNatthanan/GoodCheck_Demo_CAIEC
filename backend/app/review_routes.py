"""
Review routes — /api/products/<id>/reviews
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, Product, Review
from app.validators import validate_review_data
from app.errors import validation_error, not_found_error, success_response
from app.permissions import get_current_active_user

reviews_bp = Blueprint('reviews', __name__, url_prefix='/api/products')


@reviews_bp.route('/<int:product_id>/reviews', methods=['POST'])
@jwt_required()
def add_review(product_id):
    """เพิ่มรีวิวสินค้า"""
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id
    product = Product.query.get(product_id)

    if not product or product.moderation_status != 'approved':
        return not_found_error('Product')

    data = request.get_json()
    is_valid, error_msg = validate_review_data(data)
    if not is_valid:
        return validation_error(error_msg)

    # ตรวจว่ารีวิวซ้ำไหม
    existing = Review.query.filter_by(
        product_id=product_id,
        reviewer_id=user_id
    ).first()
    if existing:
        return jsonify({'message': 'You have already reviewed this product.'}), 409

    review = Review(
        product_id=product_id,
        reviewer_id=user_id,
        rating=data['rating'],
        comment=data.get('comment', '')
    )

    db.session.add(review)

    # Update product average rating
    all_reviews = product.reviews + [review]
    avg_rating = sum(r.rating for r in all_reviews) / len(all_reviews)
    product.rating = round(avg_rating, 1)
    product.total_reviews = len(all_reviews)

    db.session.commit()

    return success_response(
        {'review': review.to_dict()},
        message='Review added successfully.',
        status=201
    )


@reviews_bp.route('/<int:product_id>/reviews', methods=['GET'])
def get_reviews(product_id):
    """ดึงรีวิวทั้งหมดของสินค้า"""
    product = Product.query.get(product_id)
    if not product:
        return not_found_error('Product')

    reviews = [r.to_dict() for r in product.reviews]
    return jsonify({
        'reviews': reviews,
        'total': len(reviews),
        'average_rating': product.rating
    }), 200
