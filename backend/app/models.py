from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

db = SQLAlchemy()

def _json_list(value):
    if not value:
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return [value] if value else []
    return value if isinstance(value, list) else []


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    location = db.Column(db.String(120))
    user_type = db.Column(db.String(20), default='buyer')  # 'buyer' or 'seller'
    profile_image = db.Column(db.String(255))
    bio = db.Column(db.Text)
    rating = db.Column(db.Float, default=5.0)
    total_reviews = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_verified = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)
    account_status = db.Column(db.String(20), default='active')
    admin_notes = db.Column(db.Text, default='')
    suspended_at = db.Column(db.DateTime, nullable=True)

    products = db.relationship('Product', backref='seller', lazy=True, foreign_keys='Product.seller_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'phone': self.phone,
            'location': self.location,
            'user_type': self.user_type,
            'profile_image': self.profile_image,
            'rating': self.rating,
            'total_reviews': self.total_reviews,
            'is_verified': self.is_verified,
            'is_admin': self.is_admin,
            'account_status': self.account_status,
            'created_at': self.created_at.isoformat(),
        }

    def to_public_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'full_name': self.full_name,
            'location': self.location,
            'user_type': self.user_type,
            'profile_image': self.profile_image,
            'rating': self.rating,
            'total_reviews': self.total_reviews,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat(),
        }

    def to_admin_dict(self):
        payload = self.to_dict()
        payload.update({
            'admin_notes': self.admin_notes or '',
            'suspended_at': self.suspended_at.isoformat() if self.suspended_at else None,
            'product_count': len(self.products),
            'purchase_count': len(self.purchases),
            'sales_count': len(self.sales),
        })
        return payload

class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False, index=True)
    description = db.Column(db.Text)
    category = db.Column(db.String(100), nullable=False, index=True)
    price = db.Column(db.Integer, nullable=False)
    condition = db.Column(db.String(50), nullable=False)  # See app.constants.PRODUCT_CONDITIONS
    location = db.Column(db.String(120), nullable=False)
    warranty = db.Column(db.String(255))
    specs = db.Column(db.JSON)
    image_url = db.Column(db.String(255))
    image_urls = db.Column(db.JSON, default=list)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Float, default=5.0)
    total_reviews = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='available')  # 'available', 'sold', 'pending'
    moderation_status = db.Column(db.String(20), default='approved')
    moderation_note = db.Column(db.Text, default='')
    reviewed_at = db.Column(db.DateTime, nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    views = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    embedding = db.Column(db.JSON, nullable=True)

    reviews = db.relationship('Review', backref='product', lazy=True, cascade='all, delete-orphan')
    reviewed_by_admin = db.relationship('User', foreign_keys=[reviewed_by], backref='reviewed_products')

    def normalized_image_urls(self):
        raw_images = self.image_urls or []

        if isinstance(raw_images, str):
            try:
                raw_images = json.loads(raw_images)
            except (TypeError, ValueError):
                raw_images = [raw_images] if raw_images else []

        if not isinstance(raw_images, list):
            raw_images = []

        normalized = [str(url).strip() for url in raw_images if str(url).strip()]

        if self.image_url and self.image_url not in normalized:
            normalized.insert(0, self.image_url)

        return normalized

    def to_dict(self, admin_view=False):
        image_urls = self.normalized_image_urls()
        payload = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'price': self.price,
            'condition': self.condition,
            'location': self.location,
            'warranty': self.warranty,
            'specs': self.specs,
            'image_url': image_urls[0] if image_urls else self.image_url,
            'image_urls': image_urls,
            'seller': self.seller.to_public_dict() if self.seller else None,
            'rating': self.rating,
            'total_reviews': self.total_reviews,
            'status': self.status,
            'moderation_status': self.moderation_status,
            'views': self.views,
            'created_at': self.created_at.isoformat(),
        }

        if admin_view:
            payload.update({
                'moderation_note': self.moderation_note or '',
                'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
                'reviewed_by': self.reviewed_by_admin.to_public_dict() if self.reviewed_by_admin else None,
                'seller': self.seller.to_admin_dict() if self.seller else None,
            })

        return payload

    def to_summary_dict(self):
        image_urls = self.normalized_image_urls()
        return {
            'id': self.id,
            'title': self.title,
            'category': self.category,
            'price': self.price,
            'image_url': image_urls[0] if image_urls else self.image_url,
            'image_urls': image_urls,
            'status': self.status,
            'moderation_status': self.moderation_status,
            'location': self.location,
            'created_at': self.created_at.isoformat(),
        }

class Review(db.Model):
    __tablename__ = 'reviews'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reviewer = db.relationship('User', backref='reviews')

    def to_dict(self):
        return {
            'id': self.id,
            'rating': self.rating,
            'comment': self.comment,
            'reviewer': self.reviewer.to_dict(),
            'created_at': self.created_at.isoformat(),
        }

class Favorite(db.Model):
    __tablename__ = 'favorites'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'product_id', name='uq_user_product_favorite'),
    )

    user = db.relationship('User', backref='favorites')
    product = db.relationship('Product', backref='favorited_by')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'product_id': self.product_id,
            'created_at': self.created_at.isoformat(),
        }

class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    # Status flow: pending_payment → paid → seller_shipped → inspection
    #              → inspection_passed → delivered → completed | cancelled
    status = db.Column(db.String(30), default='pending_payment')
    total_price = db.Column(db.Integer, nullable=False)
    shipping_address = db.Column(db.Text, default='')
    note = db.Column(db.Text, default='')
    # Payment fields (mockup)
    payment_method = db.Column(db.String(20), default='card')
    payment_status = db.Column(db.String(20), default='pending')  # pending, paid
    payment_last4 = db.Column(db.String(4), default='')
    payment_name = db.Column(db.String(120), default='')
    # Inspection / tracking
    tracking_note = db.Column(db.Text, default='')
    inspection_result = db.Column(db.String(20), default='')
    escrow_status = db.Column(db.String(20), default='pending')  # pending, holding, released, refunded, cancelled
    seller_shipped_at = db.Column(db.DateTime, nullable=True)
    inspection_started_at = db.Column(db.DateTime, nullable=True)
    inspection_passed_at = db.Column(db.DateTime, nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)
    buyer_confirmed_at = db.Column(db.DateTime, nullable=True)
    escrow_released_at = db.Column(db.DateTime, nullable=True)
    escrow_refunded_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = db.relationship('User', foreign_keys=[buyer_id], backref='purchases')
    seller = db.relationship('User', foreign_keys=[seller_id], backref='sales')
    product = db.relationship('Product', backref='orders')

    def to_dict(self):
        return {
            'id': self.id,
            'buyer': self.buyer.to_public_dict() if self.buyer else None,
            'seller': self.seller.to_public_dict() if self.seller else None,
            'product': self.product.to_summary_dict() if self.product else None,
            'status': self.status,
            'total_price': self.total_price,
            'shipping_address': self.shipping_address,
            'note': self.note,
            'payment_method': self.payment_method,
            'payment_status': self.payment_status,
            'payment_last4': self.payment_last4,
            'payment_name': self.payment_name,
            'tracking_note': self.tracking_note or '',
            'inspection_result': self.inspection_result or '',
            'escrow_status': self.escrow_status or 'pending',
            'seller_shipped_at': self.seller_shipped_at.isoformat() if self.seller_shipped_at else None,
            'inspection_started_at': self.inspection_started_at.isoformat() if self.inspection_started_at else None,
            'inspection_passed_at': self.inspection_passed_at.isoformat() if self.inspection_passed_at else None,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'buyer_confirmed_at': self.buyer_confirmed_at.isoformat() if self.buyer_confirmed_at else None,
            'escrow_released_at': self.escrow_released_at.isoformat() if self.escrow_released_at else None,
            'escrow_refunded_at': self.escrow_refunded_at.isoformat() if self.escrow_refunded_at else None,
            'buyer_claim': self.buyer_claim.to_dict() if self.buyer_claim else None,
            'seller_review': self.seller_review.to_dict() if self.seller_review else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class BuyerProtectionClaim(db.Model):
    __tablename__ = 'buyer_protection_claims'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, unique=True, index=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    reason = db.Column(db.String(50), nullable=False, index=True)
    details = db.Column(db.Text, default='')
    evidence_urls = db.Column(db.JSON, default=list)
    requested_resolution = db.Column(db.String(30), default='review')
    status = db.Column(db.String(30), default='open', index=True)
    admin_note = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    order = db.relationship(
        'Order',
        backref=db.backref('buyer_claim', uselist=False, cascade='all, delete-orphan')
    )
    buyer = db.relationship('User', foreign_keys=[buyer_id], backref='buyer_claims')
    seller = db.relationship('User', foreign_keys=[seller_id], backref='seller_claims')
    resolved_by_admin = db.relationship('User', foreign_keys=[resolved_by], backref='resolved_buyer_claims')

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'reason': self.reason,
            'details': self.details or '',
            'evidence_urls': _json_list(self.evidence_urls),
            'requested_resolution': self.requested_resolution or 'review',
            'status': self.status,
            'admin_note': self.admin_note or '',
            'buyer': self.buyer.to_public_dict() if self.buyer else None,
            'seller': self.seller.to_public_dict() if self.seller else None,
            'product': self.order.product.to_summary_dict() if self.order and self.order.product else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by': self.resolved_by_admin.to_public_dict() if self.resolved_by_admin else None,
        }


class VerificationEvent(db.Model):
    __tablename__ = 'verification_events'

    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(40), default='compare_page', index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True, index=True)
    image1_name = db.Column(db.String(255), default='')
    image2_name = db.Column(db.String(255), default='')
    verdict = db.Column(db.String(30), nullable=False, index=True)
    is_same_item = db.Column(db.Boolean, default=False, index=True)
    overall_similarity = db.Column(db.Integer, default=0)
    same_item_confidence = db.Column(db.Integer, default=0)
    product_category = db.Column(db.String(120), default='', index=True)
    matched_attributes = db.Column(db.JSON, default=list)
    distinguishing_details = db.Column(db.JSON, default=list)
    differences = db.Column(db.JSON, default=list)
    reasoning = db.Column(db.Text, default='')
    feedback_label = db.Column(db.String(30), default='', index=True)
    feedback_note = db.Column(db.Text, default='')
    feedback_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    feedback_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', foreign_keys=[user_id], backref='verification_events')
    product = db.relationship('Product', foreign_keys=[product_id], backref='verification_events')
    feedback_user = db.relationship('User', foreign_keys=[feedback_by], backref='verification_feedback')

    def to_dict(self):
        return {
            'id': self.id,
            'source': self.source,
            'user': self.user.to_public_dict() if self.user else None,
            'product': self.product.to_summary_dict() if self.product else None,
            'image1_name': self.image1_name or '',
            'image2_name': self.image2_name or '',
            'verdict': self.verdict,
            'is_same_item': bool(self.is_same_item),
            'overall_similarity': int(self.overall_similarity or 0),
            'same_item_confidence': int(self.same_item_confidence or 0),
            'product_category': self.product_category or '',
            'matched_attributes': _json_list(self.matched_attributes),
            'distinguishing_details': _json_list(self.distinguishing_details),
            'differences': _json_list(self.differences),
            'reasoning': self.reasoning or '',
            'feedback_label': self.feedback_label or '',
            'feedback_note': self.feedback_note or '',
            'feedback_by': self.feedback_user.to_public_dict() if self.feedback_user else None,
            'feedback_at': self.feedback_at.isoformat() if self.feedback_at else None,
            'created_at': self.created_at.isoformat(),
        }


class SellerReview(db.Model):
    __tablename__ = 'seller_reviews'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, unique=True, index=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    order = db.relationship(
        'Order',
        backref=db.backref('seller_review', uselist=False, cascade='all, delete-orphan')
    )
    seller = db.relationship('User', foreign_keys=[seller_id], backref='seller_reviews_received')
    buyer = db.relationship('User', foreign_keys=[buyer_id], backref='seller_reviews_written')

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'seller_id': self.seller_id,
            'rating': self.rating,
            'comment': self.comment or '',
            'reviewer': self.buyer.to_public_dict() if self.buyer else None,
            'product': self.order.product.to_summary_dict() if self.order and self.order.product else None,
            'created_at': self.created_at.isoformat(),
        }


class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_message_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        db.UniqueConstraint('product_id', 'buyer_id', 'seller_id', name='uq_conversation_product_buyer_seller'),
    )

    product = db.relationship('Product', backref='conversations')
    buyer = db.relationship('User', foreign_keys=[buyer_id], backref='buyer_conversations')
    seller = db.relationship('User', foreign_keys=[seller_id], backref='seller_conversations')
    messages = db.relationship(
        'ChatMessage',
        backref='conversation',
        lazy=True,
        cascade='all, delete-orphan',
        order_by='ChatMessage.created_at.asc()'
    )

    def to_dict(self, viewer_id=None, include_messages=False):
        counterpart = self.seller if viewer_id == self.buyer_id else self.buyer
        last_message = self.messages[-1] if self.messages else None

        payload = {
            'id': self.id,
            'product': self.product.to_summary_dict() if self.product else None,
            'buyer': self.buyer.to_public_dict() if self.buyer else None,
            'seller': self.seller.to_public_dict() if self.seller else None,
            'counterpart': counterpart.to_public_dict() if counterpart else None,
            'last_message_preview': last_message.content if last_message else '',
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'message_count': len(self.messages),
        }

        if include_messages:
            payload['messages'] = [message.to_dict() for message in self.messages]

        return payload


class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    sender = db.relationship('User', backref='sent_chat_messages')

    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'content': self.content,
            'sender': self.sender.to_public_dict() if self.sender else None,
            'sender_id': self.sender_id,
            'created_at': self.created_at.isoformat(),
        }


class ModerationLog(db.Model):
    __tablename__ = 'moderation_logs'

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    target_type = db.Column(db.String(40), nullable=False, index=True)
    target_id = db.Column(db.Integer, nullable=False, index=True)
    action = db.Column(db.String(60), nullable=False, index=True)
    note = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    admin = db.relationship('User', backref='moderation_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'admin': self.admin.to_public_dict() if self.admin else None,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'action': self.action,
            'note': self.note,
            'created_at': self.created_at.isoformat(),
        }
