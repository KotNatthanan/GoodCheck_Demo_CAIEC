"""
Admin routes — /api/admin
"""
from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import case, or_

from app.errors import not_found_error, success_response, validation_error
from app.models import BuyerProtectionClaim, ChatMessage, ModerationLog, Order, Product, Review, User, db
from app.permissions import get_current_admin_user
from app.validators import (
    VALID_PRODUCT_MODERATION_STATUSES,
    validate_admin_claim_update,
    validate_admin_user_status,
)
from flask_jwt_extended import jwt_required

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def _write_log(admin_id, target_type, target_id, action, note=''):
    log = ModerationLog(
        admin_id=admin_id,
        target_type=target_type,
        target_id=target_id,
        action=action,
        note=note or '',
    )
    db.session.add(log)


@admin_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_overview():
    admin, error = get_current_admin_user()
    if error:
        return error

    del admin  # admin check only

    overview = {
        'users': {
            'total': User.query.count(),
            'active': User.query.filter_by(account_status='active').count(),
            'suspended': User.query.filter_by(account_status='suspended').count(),
            'sellers': User.query.filter_by(user_type='seller').count(),
            'buyers': User.query.filter_by(user_type='buyer').count(),
            'admins': User.query.filter_by(is_admin=True).count(),
        },
        'products': {
            'total': Product.query.count(),
            'pending': Product.query.filter_by(moderation_status='pending').count(),
            'approved': Product.query.filter_by(moderation_status='approved').count(),
            'rejected': Product.query.filter_by(moderation_status='rejected').count(),
            'hidden': Product.query.filter_by(moderation_status='hidden').count(),
            'live': Product.query.filter(
                Product.moderation_status == 'approved',
                Product.status == 'available',
            ).count(),
        },
        'orders': {
            'total': Order.query.count(),
            'pending_payment': Order.query.filter_by(status='pending_payment').count(),
            'paid': Order.query.filter_by(status='paid').count(),
            'seller_shipped': Order.query.filter_by(status='seller_shipped').count(),
            'inspection': Order.query.filter(Order.status.in_(['inspection', 'inspection_passed'])).count(),
            'delivered': Order.query.filter_by(status='delivered').count(),
            'completed': Order.query.filter_by(status='completed').count(),
            'cancelled': Order.query.filter_by(status='cancelled').count(),
        },
        'claims': {
            'total': BuyerProtectionClaim.query.count(),
            'open': BuyerProtectionClaim.query.filter_by(status='open').count(),
            'reviewing': BuyerProtectionClaim.query.filter_by(status='reviewing').count(),
            'resolved': BuyerProtectionClaim.query.filter(
                BuyerProtectionClaim.status.in_(['resolved_refund', 'resolved_release'])
            ).count(),
            'rejected': BuyerProtectionClaim.query.filter_by(status='rejected').count(),
        },
        'engagement': {
            'reviews': Review.query.count(),
            'chat_messages': ChatMessage.query.count(),
        },
    }

    return jsonify(overview), 200


@admin_bp.route('/products', methods=['GET'])
@jwt_required()
def get_admin_products():
    admin, error = get_current_admin_user()
    if error:
        return error

    del admin
    moderation_status = request.args.get('moderation_status', '', type=str)
    search = request.args.get('search', '', type=str).strip()
    limit = request.args.get('limit', 20, type=int)

    query = Product.query.join(User, Product.seller_id == User.id)

    if moderation_status and moderation_status != 'all':
        query = query.filter(Product.moderation_status == moderation_status)

    if search:
        pattern = f'%{search}%'
        query = query.filter(
            or_(
                Product.title.ilike(pattern),
                Product.category.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.full_name.ilike(pattern),
            )
        )

    products = (
        query.order_by(
            case_pending_first(Product.moderation_status),
            Product.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return jsonify({
        'products': [product.to_dict(admin_view=True) for product in products],
        'total': len(products),
    }), 200


def case_pending_first(column):
    return case(
        (column == 'pending', 0),
        (column == 'rejected', 1),
        (column == 'hidden', 2),
        else_=3,
    )


@admin_bp.route('/products/<int:product_id>/moderation', methods=['PUT'])
@jwt_required()
def moderate_product(product_id):
    admin, error = get_current_admin_user()
    if error:
        return error

    product = Product.query.get(product_id)
    if not product:
        return not_found_error('Product')

    data = request.get_json() or {}
    new_status = data.get('moderation_status')
    moderation_note = str(data.get('moderation_note', '')).strip()

    if new_status not in VALID_PRODUCT_MODERATION_STATUSES:
        return validation_error(
            f'Moderation status must be one of: {", ".join(VALID_PRODUCT_MODERATION_STATUSES)}.'
        )

    product.moderation_status = new_status
    product.moderation_note = moderation_note
    product.reviewed_at = datetime.utcnow()
    product.reviewed_by = admin.id

    if new_status == 'rejected' and product.status == 'pending':
        product.status = 'available'

    _write_log(
        admin.id,
        'product',
        product.id,
        f'product_{new_status}',
        moderation_note or f'Listing marked as {new_status}.',
    )
    db.session.commit()

    return success_response(
        {'product': product.to_dict(admin_view=True)},
        message=f'Listing marked as {new_status}.',
    )


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_admin_users():
    admin, error = get_current_admin_user()
    if error:
        return error

    del admin
    account_status = request.args.get('account_status', '', type=str)
    user_type = request.args.get('user_type', '', type=str)
    search = request.args.get('search', '', type=str).strip()
    limit = request.args.get('limit', 20, type=int)

    query = User.query

    if account_status and account_status != 'all':
        query = query.filter(User.account_status == account_status)

    if user_type and user_type != 'all':
        query = query.filter(User.user_type == user_type)

    if search:
        pattern = f'%{search}%'
        query = query.filter(
            or_(
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.full_name.ilike(pattern),
            )
        )

    users = query.order_by(User.created_at.desc()).limit(limit).all()

    return jsonify({
        'users': [user.to_admin_dict() for user in users],
        'total': len(users),
    }), 200


@admin_bp.route('/users/<int:user_id>/status', methods=['PUT'])
@jwt_required()
def update_user_status(user_id):
    admin, error = get_current_admin_user()
    if error:
        return error

    user = User.query.get(user_id)
    if not user:
        return not_found_error('User')

    data = request.get_json() or {}
    is_valid, error_msg = validate_admin_user_status(data)
    if not is_valid:
        return validation_error(error_msg)

    if user.id == admin.id and data.get('account_status') == 'suspended':
        return validation_error('You cannot suspend your own admin account.')

    if 'account_status' in data and data['account_status']:
        user.account_status = data['account_status']
        user.suspended_at = datetime.utcnow() if data['account_status'] == 'suspended' else None

    if 'is_verified' in data:
        user.is_verified = bool(data['is_verified'])

    if 'admin_notes' in data:
        user.admin_notes = str(data.get('admin_notes') or '').strip()

    _write_log(
        admin.id,
        'user',
        user.id,
        f"user_{user.account_status}",
        user.admin_notes or 'User account updated by admin.',
    )
    db.session.commit()

    return success_response(
        {'user': user.to_admin_dict()},
        message='User status updated successfully.',
    )


@admin_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    admin, error = get_current_admin_user()
    if error:
        return error

    del admin
    limit = request.args.get('limit', 25, type=int)
    logs = ModerationLog.query.order_by(ModerationLog.created_at.desc()).limit(limit).all()

    return jsonify({
        'logs': [log.to_dict() for log in logs],
        'total': len(logs),
    }), 200


@admin_bp.route('/orders', methods=['GET'])
@jwt_required()
def get_admin_orders():
    """List all orders for admin — filterable by status"""
    admin, error = get_current_admin_user()
    if error:
        return error
    del admin

    status_filter = request.args.get('status', '', type=str).strip()
    limit = request.args.get('limit', 30, type=int)

    query = Order.query
    if status_filter and status_filter != 'all':
        query = query.filter(Order.status == status_filter)

    orders = query.order_by(Order.updated_at.desc()).limit(limit).all()
    return jsonify({
        'orders': [o.to_dict() for o in orders],
        'total': len(orders),
    }), 200


def case_claim_priority(column):
    return case(
        (column == 'open', 0),
        (column == 'reviewing', 1),
        (column == 'rejected', 2),
        else_=3,
    )


@admin_bp.route('/claims', methods=['GET'])
@jwt_required()
def get_admin_claims():
    admin, error = get_current_admin_user()
    if error:
        return error
    del admin

    status_filter = request.args.get('status', 'open', type=str).strip()
    limit = request.args.get('limit', 20, type=int)

    query = BuyerProtectionClaim.query
    if status_filter and status_filter != 'all':
        query = query.filter(BuyerProtectionClaim.status == status_filter)

    claims = (
        query.order_by(
            case_claim_priority(BuyerProtectionClaim.status),
            BuyerProtectionClaim.updated_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return jsonify({
        'claims': [claim.to_dict() for claim in claims],
        'total': len(claims),
    }), 200


@admin_bp.route('/claims/<int:claim_id>', methods=['PUT'])
@jwt_required()
def update_admin_claim_status(claim_id):
    admin, error = get_current_admin_user()
    if error:
        return error

    claim = BuyerProtectionClaim.query.get(claim_id)
    if not claim:
        return not_found_error('Claim')

    data = request.get_json() or {}
    is_valid, error_msg = validate_admin_claim_update(data)
    if not is_valid:
        return validation_error(error_msg)

    new_status = data.get('status', '').strip()
    admin_note = str(data.get('admin_note') or '').strip()
    allowed_transitions = {
        'open': ['reviewing', 'resolved_refund', 'resolved_release', 'rejected'],
        'reviewing': ['resolved_refund', 'resolved_release', 'rejected'],
        'resolved_refund': [],
        'resolved_release': [],
        'rejected': [],
    }

    current_status = claim.status
    allowed = allowed_transitions.get(current_status, [])
    if new_status not in allowed:
        return validation_error(
            f'Cannot move claim from "{current_status}" to "{new_status}". '
            f'Allowed transitions: {", ".join(allowed) if allowed else "none"}.'
        )

    claim.status = new_status
    claim.admin_note = admin_note
    if new_status in ('resolved_refund', 'resolved_release', 'rejected'):
        claim.resolved_at = datetime.utcnow()
        claim.resolved_by = admin.id

    _write_log(
        admin.id,
        'claim',
        claim.id,
        f'claim_{new_status}',
        admin_note or f'Buyer protection claim moved to {new_status}.',
    )
    db.session.commit()

    return success_response(
        {'claim': claim.to_dict()},
        message=f'Claim status updated to "{new_status}".',
    )


@admin_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@jwt_required()
def admin_update_order_status(order_id):
    """Admin advances order through inspection workflow"""
    admin, error = get_current_admin_user()
    if error:
        return error

    order = Order.query.get(order_id)
    if not order:
        return not_found_error('Order')

    data = request.get_json() or {}
    new_status = data.get('status', '').strip()
    tracking_note = data.get('tracking_note', '').strip()

    ADMIN_ALLOWED = {
        'seller_shipped': ['inspection', 'cancelled'],
        'inspection': ['inspection_passed', 'cancelled'],
        'inspection_passed': ['delivered'],
        'delivered': ['completed'],
        'paid': ['cancelled'],
    }

    current = order.status
    allowed = ADMIN_ALLOWED.get(current, [])
    if new_status not in allowed:
        return validation_error(
            f'Cannot move from "{current}" to "{new_status}". '
            f'Allowed: {allowed or "none"}.'
        )

    order.status = new_status
    if tracking_note:
        order.tracking_note = tracking_note
    if new_status == 'inspection_passed':
        order.inspection_result = 'passed'
    elif new_status == 'cancelled':
        order.inspection_result = 'failed'
        product = Product.query.get(order.product_id)
        if product:
            product.status = 'available'
    elif new_status == 'completed':
        product = Product.query.get(order.product_id)
        if product:
            product.status = 'sold'

    _write_log(admin.id, 'order', order.id, f'order_{new_status}', tracking_note or f'Order moved to {new_status}.')
    db.session.commit()

    return success_response(
        {'order': order.to_dict()},
        message=f'Order status updated to "{new_status}".'
    )
