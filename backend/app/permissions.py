"""
Permission and current-user helpers
"""
from flask_jwt_extended import get_jwt_identity

from app.errors import not_found_error, unauthorized_error
from app.models import User


def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return None, not_found_error('User')
    return user, None


def get_current_active_user():
    user, error = get_current_user()
    if error:
        return None, error

    if user.account_status != 'active':
        return None, unauthorized_error('Your account is currently suspended. Please contact support.')

    return user, None


def get_current_admin_user():
    user, error = get_current_active_user()
    if error:
        return None, error

    if not user.is_admin:
        return None, unauthorized_error('Admin access is required for this action.')

    return user, None
