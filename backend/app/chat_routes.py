"""
Chat routes — /api/chats
"""
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.errors import not_found_error, unauthorized_error, success_response, validation_error
from app.models import ChatMessage, Conversation, Product, User, db
from app.permissions import get_current_active_user
from app.validators import validate_chat_message_data

chats_bp = Blueprint('chats', __name__, url_prefix='/api/chats')


def _get_conversation_for_user(conversation_id, user_id):
    conversation = Conversation.query.get(conversation_id)
    if not conversation:
        return None, not_found_error('Conversation')

    if conversation.buyer_id != user_id and conversation.seller_id != user_id:
        return None, unauthorized_error('You are not allowed to access this conversation.')

    return conversation, None


@chats_bp.route('', methods=['GET'])
@jwt_required()
def get_my_conversations():
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id
    conversations = (
        Conversation.query.filter(
            (Conversation.buyer_id == user_id) | (Conversation.seller_id == user_id)
        )
        .order_by(Conversation.last_message_at.desc(), Conversation.updated_at.desc())
        .all()
    )

    return jsonify({
        'conversations': [conversation.to_dict(viewer_id=user_id) for conversation in conversations],
        'total': len(conversations),
    }), 200


@chats_bp.route('', methods=['POST'])
@jwt_required()
def start_conversation():
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id

    data = request.get_json()
    is_valid, error_msg = validate_chat_message_data(data, require_product=True)
    if not is_valid:
        return validation_error(error_msg)

    product = Product.query.get(data['product_id'])
    if not product or product.moderation_status != 'approved':
        return not_found_error('Product')

    if product.seller_id == user_id:
        return validation_error('You cannot start a conversation on your own listing.')

    conversation = Conversation.query.filter_by(
        product_id=product.id,
        buyer_id=user_id,
        seller_id=product.seller_id,
    ).first()

    created = False
    if not conversation:
        conversation = Conversation(
            product_id=product.id,
            buyer_id=user_id,
            seller_id=product.seller_id,
        )
        db.session.add(conversation)
        db.session.flush()
        created = True

    message = ChatMessage(
        conversation_id=conversation.id,
        sender_id=user_id,
        content=str(data.get('content', '')).strip(),
    )
    conversation.last_message_at = datetime.utcnow()

    db.session.add(message)
    db.session.commit()

    return success_response(
        {'conversation': conversation.to_dict(viewer_id=user_id, include_messages=True)},
        message='Conversation started successfully.' if created else 'Message sent successfully.',
        status=201 if created else 200,
    )


@chats_bp.route('/<int:conversation_id>', methods=['GET'])
@jwt_required()
def get_conversation(conversation_id):
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id
    conversation, error = _get_conversation_for_user(conversation_id, user_id)
    if error:
        return error

    return jsonify(conversation.to_dict(viewer_id=user_id, include_messages=True)), 200


@chats_bp.route('/<int:conversation_id>/messages', methods=['POST'])
@jwt_required()
def send_message(conversation_id):
    user, error = get_current_active_user()
    if error:
        return error

    user_id = user.id
    conversation, error = _get_conversation_for_user(conversation_id, user_id)
    if error:
        return error

    data = request.get_json()
    is_valid, error_msg = validate_chat_message_data(data, require_product=False)
    if not is_valid:
        return validation_error(error_msg)

    message = ChatMessage(
        conversation_id=conversation.id,
        sender_id=user_id,
        content=str(data.get('content', '')).strip(),
    )

    conversation.last_message_at = datetime.utcnow()
    db.session.add(message)
    db.session.commit()

    return success_response(
        {
            'chat_message': message.to_dict(),
            'conversation': conversation.to_dict(viewer_id=user_id),
        },
        message='Message sent successfully.',
        status=201,
    )
