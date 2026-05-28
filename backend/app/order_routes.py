"""
Order routes — /api/orders
Status flow:
  pending_payment → paid → seller_shipped → inspection
  → inspection_passed → delivered → completed | cancelled
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, Order, Product, User, Conversation, ChatMessage
from app.validators import validate_order_data
from app.errors import validation_error, not_found_error, unauthorized_error, success_response
from app.permissions import get_current_active_user

orders_bp = Blueprint('orders', __name__, url_prefix='/api/orders')

# Allowed status transitions per role
BUYER_TRANSITIONS = {
    'pending_payment': ['cancelled'],
    'paid': ['cancelled'],
}

SELLER_TRANSITIONS = {
    'paid': ['seller_shipped'],
}

ADMIN_TRANSITIONS = {
    'seller_shipped': ['inspection', 'cancelled'],
    'inspection': ['inspection_passed', 'cancelled'],
    'inspection_passed': ['delivered'],
    'delivered': ['completed'],
}


@orders_bp.route('', methods=['POST'])
@jwt_required()
def create_order():
    """Create an order — always starts at pending_payment"""
    user, error = get_current_active_user()
    if error:
        return error

    data = request.get_json()
    is_valid, error_msg = validate_order_data(data)
    if not is_valid:
        return validation_error(error_msg)

    product = Product.query.get(data['product_id'])
    if not product or product.moderation_status != 'approved':
        return not_found_error('Product')

    if product.status != 'available':
        return jsonify({'message': 'This product is not available for sale.'}), 400

    if product.seller_id == user.id:
        return jsonify({'message': 'You cannot purchase your own product.'}), 400

    order = Order(
        buyer_id=user.id,
        product_id=product.id,
        seller_id=product.seller_id,
        total_price=product.price,
        shipping_address=data.get('shipping_address', ''),
        note=data.get('note', ''),
        status='pending_payment',
        payment_status='pending',
    )

    product.status = 'pending'
    db.session.add(order)
    db.session.flush()

    # Automatically notify seller via chat
    conversation = Conversation.query.filter_by(
        product_id=product.id,
        buyer_id=user.id,
        seller_id=product.seller_id,
    ).first()

    if not conversation:
        conversation = Conversation(
            product_id=product.id,
            buyer_id=user.id,
            seller_id=product.seller_id,
        )
        db.session.add(conversation)
        db.session.flush()

    notification_msg = ChatMessage(
        conversation_id=conversation.id,
        sender_id=user.id,
        content=f"✅ System Update: I have placed an order for this item. Please proceed with the next steps."
    )
    conversation.last_message_at = datetime.utcnow()
    db.session.add(notification_msg)

    db.session.commit()

    return success_response(
        {'order': order.to_dict()},
        message='Order created. Please proceed to payment.',
        status=201
    )


@orders_bp.route('/<int:order_id>/pay', methods=['POST'])
@jwt_required()
def pay_order(order_id):
    """Mockup payment — accepts card details and marks order as paid"""
    user, error = get_current_active_user()
    if error:
        return error

    order = Order.query.get(order_id)
    if not order:
        return not_found_error('Order')

    if order.buyer_id != user.id:
        return unauthorized_error('You are not the buyer of this order.')

    if order.status != 'pending_payment':
        return jsonify({'message': 'This order has already been paid or cannot be paid.'}), 400

    data = request.get_json() or {}
    card_number = str(data.get('card_number', '')).replace(' ', '')
    card_name = data.get('card_name', '').strip()
    card_expiry = data.get('card_expiry', '').strip()
    card_cvv = data.get('card_cvv', '').strip()

    if not card_number or len(card_number) < 13:
        return validation_error('Please enter a valid card number.')
    if not card_name:
        return validation_error('Please enter the name on your card.')
    if not card_expiry:
        return validation_error('Please enter the card expiry date.')
    if not card_cvv or len(card_cvv) < 3:
        return validation_error('Please enter a valid CVV.')

    # Mockup: always approve
    order.status = 'paid'
    order.payment_status = 'paid'
    order.payment_last4 = card_number[-4:]
    order.payment_name = card_name

    db.session.commit()

    return success_response(
        {'order': order.to_dict()},
        message='Payment successful! The seller will be notified to ship the item to GoodCheck.'
    )


@orders_bp.route('', methods=['GET'])
@jwt_required()
def get_my_orders():
    """Get orders for current user (buyer or seller role)"""
    user, error = get_current_active_user()
    if error:
        return error

    role = request.args.get('role', 'buyer', type=str)

    if role == 'seller':
        orders = Order.query.filter_by(seller_id=user.id).order_by(Order.created_at.desc()).all()
    else:
        orders = Order.query.filter_by(buyer_id=user.id).order_by(Order.created_at.desc()).all()

    return jsonify({
        'orders': [o.to_dict() for o in orders],
        'total': len(orders)
    }), 200


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    """Get single order detail"""
    user, error = get_current_active_user()
    if error:
        return error

    order = Order.query.get(order_id)
    if not order:
        return not_found_error('Order')

    if order.buyer_id != user.id and order.seller_id != user.id and not user.is_admin:
        return unauthorized_error('You are not allowed to view this order.')

    return jsonify(order.to_dict()), 200


@orders_bp.route('/<int:order_id>/status', methods=['PUT'])
@jwt_required()
def update_order_status(order_id):
    """Update order status — role-gated transitions"""
    user, error = get_current_active_user()
    if error:
        return error

    order = Order.query.get(order_id)
    if not order:
        return not_found_error('Order')

    data = request.get_json() or {}
    new_status = data.get('status', '').strip()
    tracking_note = data.get('tracking_note', '').strip()

    current = order.status

    # Determine allowed transitions
    if user.is_admin:
        allowed = ADMIN_TRANSITIONS.get(current, [])
    elif order.seller_id == user.id:
        allowed = SELLER_TRANSITIONS.get(current, [])
    elif order.buyer_id == user.id:
        allowed = BUYER_TRANSITIONS.get(current, [])
    else:
        return unauthorized_error('You are not allowed to update this order.')

    if new_status not in allowed:
        return validation_error(
            f'Cannot move order from "{current}" to "{new_status}". '
            f'Allowed transitions: {", ".join(allowed) if allowed else "none"}.'
        )

    order.status = new_status
    if tracking_note:
        order.tracking_note = tracking_note

    # Update inspection_result
    if new_status == 'inspection_passed':
        order.inspection_result = 'passed'
    elif new_status == 'cancelled' and current in ('inspection',):
        order.inspection_result = 'failed'

    # Sync product status
    product = Product.query.get(order.product_id)
    if product:
        if new_status == 'completed':
            product.status = 'sold'
        elif new_status == 'cancelled':
            product.status = 'available'

    db.session.commit()

    return success_response(
        {'order': order.to_dict()},
        message=f'Order status updated to "{new_status}".'
    )
