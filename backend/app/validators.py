"""
Input validation utilities for API request data
"""
from app.constants import (
    ACCOUNT_STATUSES,
    CLAIM_REASONS,
    CLAIM_STATUSES,
    PRODUCT_CONDITIONS,
    PRODUCT_MODERATION_STATUSES,
    PRODUCT_STATUSES,
    USER_TYPES,
)

VALID_CONDITIONS = PRODUCT_CONDITIONS
VALID_USER_TYPES = USER_TYPES
VALID_PRODUCT_STATUSES = PRODUCT_STATUSES
VALID_PRODUCT_MODERATION_STATUSES = PRODUCT_MODERATION_STATUSES
VALID_ACCOUNT_STATUSES = ACCOUNT_STATUSES
VALID_CLAIM_REASONS = CLAIM_REASONS
VALID_CLAIM_STATUSES = CLAIM_STATUSES


def validate_product_data(data, required=True):
    """
    Validate product creation/update data.
    Returns (is_valid, error_message).
    """
    if not data:
        return False, 'Product payload is required.'

    if required:
        if not data.get('title'):
            return False, 'Product title is required.'
        if not data.get('price') and data.get('price') != 0:
            return False, 'Price is required.'
        if not data.get('category'):
            return False, 'Category is required.'

    if 'price' in data:
        try:
            price = int(data['price'])
            if price < 0:
                return False, 'Price must be greater than or equal to 0.'
        except (ValueError, TypeError):
            return False, 'Price must be a number.'

    if 'condition' in data and data['condition']:
        if data['condition'] not in VALID_CONDITIONS:
            return False, f'Condition must be one of: {", ".join(VALID_CONDITIONS)}.'

    if 'status' in data and data['status']:
        if data['status'] not in VALID_PRODUCT_STATUSES:
            return False, f'Status must be one of: {", ".join(VALID_PRODUCT_STATUSES)}.'

    if 'moderation_status' in data and data['moderation_status']:
        if data['moderation_status'] not in VALID_PRODUCT_MODERATION_STATUSES:
            return False, f'Moderation status must be one of: {", ".join(VALID_PRODUCT_MODERATION_STATUSES)}.'

    return True, None


def validate_user_registration(data):
    """
    Validate user registration data.
    Returns (is_valid, error_message).
    """
    if not data:
        return False, 'Registration payload is required.'

    if not data.get('username'):
        return False, 'Username is required.'
    if not data.get('email'):
        return False, 'Email is required.'
    if not data.get('password'):
        return False, 'Password is required.'

    if len(data['username']) < 3:
        return False, 'Username must be at least 3 characters long.'
    if len(data['password']) < 6:
        return False, 'Password must be at least 6 characters long.'
    if '@' not in data['email']:
        return False, 'Email format is invalid.'

    if data.get('user_type') and data['user_type'] not in VALID_USER_TYPES:
        return False, f'User type must be one of: {", ".join(VALID_USER_TYPES)}.'

    return True, None


def validate_review_data(data):
    """
    Validate review data.
    Returns (is_valid, error_message).
    """
    if not data:
        return False, 'Review payload is required.'

    if not data.get('rating'):
        return False, 'Rating is required.'

    try:
        rating = int(data['rating'])
        if rating < 1 or rating > 5:
            return False, 'Rating must be between 1 and 5.'
    except (ValueError, TypeError):
        return False, 'Rating must be a number.'

    return True, None


def validate_order_data(data):
    """
    Validate order data.
    Returns (is_valid, error_message).
    """
    if not data:
        return False, 'Order payload is required.'

    if not data.get('product_id'):
        return False, 'Product ID is required.'

    return True, None


def validate_buyer_claim_data(data):
    """
    Validate buyer protection claim data.
    Returns (is_valid, error_message).
    """
    if not data:
        return False, 'Claim payload is required.'

    reason = str(data.get('reason') or '').strip()
    details = str(data.get('details') or '').strip()

    if not reason:
        return False, 'Claim reason is required.'
    if reason not in VALID_CLAIM_REASONS:
        return False, f'Claim reason must be one of: {", ".join(VALID_CLAIM_REASONS)}.'
    if len(details) < 10:
        return False, 'Please provide at least 10 characters describing the issue.'
    if len(details) > 3000:
        return False, 'Claim details must be 3000 characters or fewer.'

    return True, None


def validate_admin_claim_update(data):
    """
    Validate admin claim update payload.
    """
    if not data:
        return False, 'Claim update payload is required.'

    status = str(data.get('status') or '').strip()
    admin_note = str(data.get('admin_note') or '').strip()

    if not status:
        return False, 'Claim status is required.'
    if status not in VALID_CLAIM_STATUSES:
        return False, f'Claim status must be one of: {", ".join(VALID_CLAIM_STATUSES)}.'
    if len(admin_note) > 3000:
        return False, 'Admin note must be 3000 characters or fewer.'

    return True, None


def validate_chat_message_data(data, require_product=False):
    """
    Validate chat conversation/message payloads.
    Returns (is_valid, error_message).
    """
    if not data:
        return False, 'Chat payload is required.'

    if require_product and not data.get('product_id'):
        return False, 'Product ID is required to start a conversation.'

    content = str(data.get('content', '')).strip()
    if not content:
        return False, 'Message content is required.'

    if len(content) > 2000:
        return False, 'Message content must be 2000 characters or fewer.'

    return True, None


def validate_admin_user_status(data):
    """
    Validate admin status updates for users.
    """
    if not data:
        return False, 'Admin payload is required.'

    if 'account_status' in data and data['account_status']:
        if data['account_status'] not in VALID_ACCOUNT_STATUSES:
            return False, f'Account status must be one of: {", ".join(VALID_ACCOUNT_STATUSES)}.'

    return True, None
