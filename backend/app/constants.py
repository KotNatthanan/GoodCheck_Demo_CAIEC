"""Shared domain constants used by API validation, seed data, and docs."""

PRODUCT_CATEGORIES = [
    'Graphics Card',
    'CPU',
    'Streaming Gear',
    'Gaming Gear',
    'Monitor',
    'Storage',
]

PRODUCT_CONDITIONS = [
    'Brand new',
    'Like new',
    'Good condition',
    'Used',
]

DEFAULT_LOCATIONS = [
    'Bangkok',
    'Chiang Mai',
    'Chonburi',
    'Khon Kaen',
    'Phuket',
]

USER_TYPES = ['buyer', 'seller']

PRODUCT_STATUSES = ['available', 'sold', 'pending']
PRODUCT_MODERATION_STATUSES = ['pending', 'approved', 'rejected', 'hidden']
ACCOUNT_STATUSES = ['active', 'suspended']

CLAIM_REASONS = [
    'damaged_in_transit',
    'not_as_described',
    'missing_parts',
    'functionality_issue',
    'seller_misrepresentation',
    'other',
]

CLAIM_STATUSES = ['open', 'reviewing', 'resolved_refund', 'resolved_release', 'rejected']
