"""
Buyer protection claim routes:
  - POST /api/orders/<id>/claim
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.errors import not_found_error, success_response, unauthorized_error, validation_error
from app.models import BuyerProtectionClaim, Order, db
from app.permissions import get_current_active_user
from app.validators import validate_buyer_claim_data

claims_bp = Blueprint('claims', __name__, url_prefix='/api')


@claims_bp.route('/orders/<int:order_id>/claim', methods=['POST'])
@jwt_required()
def create_buyer_claim(order_id):
    user, error = get_current_active_user()
    if error:
        return error

    order = Order.query.get(order_id)
    if not order:
        return not_found_error('Order')

    if order.buyer_id != user.id:
        return unauthorized_error('You are not the buyer of this order.')

    if order.status not in ('delivered', 'completed'):
        return validation_error('Buyer protection claims can be opened only after delivery.')

    existing = BuyerProtectionClaim.query.filter_by(order_id=order.id).first()
    if existing:
        return jsonify({'message': 'A buyer protection claim already exists for this order.'}), 409

    data = request.get_json()
    is_valid, error_msg = validate_buyer_claim_data(data)
    if not is_valid:
        return validation_error(error_msg)

    claim = BuyerProtectionClaim(
        order_id=order.id,
        buyer_id=user.id,
        seller_id=order.seller_id,
        reason=data['reason'],
        details=str(data.get('details') or '').strip(),
        evidence_urls=[
            str(url).strip()
            for url in (data.get('evidence_urls') or [])
            if str(url).strip()
        ],
        requested_resolution=str(data.get('requested_resolution') or 'review').strip(),
        status='open',
    )

    db.session.add(claim)
    db.session.commit()

    return success_response(
        {'buyer_claim': claim.to_dict()},
        message='Buyer protection claim submitted successfully.',
        status=201,
    )
