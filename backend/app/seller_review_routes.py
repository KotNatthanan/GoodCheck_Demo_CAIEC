"""
Seller review routes:
  - POST /api/orders/<id>/seller-review
  - GET  /api/sellers/<id>/reviews
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.models import db, Order, SellerReview, User
from app.validators import validate_review_data
from app.errors import validation_error, not_found_error, unauthorized_error, success_response
from app.permissions import get_current_active_user

seller_reviews_bp = Blueprint('seller_reviews', __name__, url_prefix='/api')


def _apply_seller_rating(seller, new_rating):
    current_total = int(seller.total_reviews or 0)
    current_rating = float(seller.rating or 5.0)
    updated_total = current_total + 1

    seller.rating = round(((current_rating * current_total) + new_rating) / updated_total, 1)
    seller.total_reviews = updated_total


@seller_reviews_bp.route('/orders/<int:order_id>/seller-review', methods=['POST'])
@jwt_required()
def add_seller_review(order_id):
    user, error = get_current_active_user()
    if error:
        return error

    order = Order.query.get(order_id)
    if not order:
        return not_found_error('Order')

    if order.buyer_id != user.id:
        return unauthorized_error('You are not the buyer of this order.')

    if order.status != 'completed':
        return validation_error('You can review the seller only after the order is completed.')

    existing = SellerReview.query.filter_by(order_id=order.id).first()
    if existing:
        return jsonify({'message': 'You have already reviewed this seller for this order.'}), 409

    data = request.get_json()
    is_valid, error_msg = validate_review_data(data)
    if not is_valid:
        return validation_error(error_msg)

    review = SellerReview(
        order_id=order.id,
        seller_id=order.seller_id,
        buyer_id=user.id,
        rating=data['rating'],
        comment=data.get('comment', '').strip(),
    )

    db.session.add(review)
    _apply_seller_rating(order.seller, review.rating)
    db.session.commit()

    return success_response(
        {'seller_review': review.to_dict()},
        message='Seller review added successfully.',
        status=201,
    )


@seller_reviews_bp.route('/sellers/<int:seller_id>/reviews', methods=['GET'])
def get_seller_reviews(seller_id):
    seller = User.query.get(seller_id)
    if not seller:
        return not_found_error('Seller')

    limit = max(1, min(request.args.get('limit', 4, type=int), 20))
    reviews = (
        SellerReview.query
        .filter_by(seller_id=seller.id)
        .order_by(SellerReview.created_at.desc())
        .limit(limit)
        .all()
    )

    return jsonify({
        'seller': seller.to_public_dict(),
        'reviews': [review.to_dict() for review in reviews],
        'total': seller.total_reviews or 0,
        'average_rating': seller.rating or 5.0,
    }), 200
