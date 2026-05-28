"""
Authentication routes — /api/auth
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, User
from app.validators import validate_user_registration
from app.errors import validation_error, not_found_error, success_response
from app.permissions import get_current_active_user

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """ลงทะเบียนผู้ใช้ใหม่"""
    data = request.get_json()

    is_valid, error_msg = validate_user_registration(data)
    if not is_valid:
        return validation_error(error_msg)

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'This username is already taken.'}), 409

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'This email address is already in use.'}), 409

    user = User(
        username=data['username'],
        email=data['email'],
        full_name=data.get('full_name', ''),
        user_type=data.get('user_type', 'buyer')
    )
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=user.id)

    return success_response(
        {'access_token': access_token, 'user': user.to_dict()},
        message='Account created successfully.',
        status=201
    )


@auth_bp.route('/login', methods=['POST'])
def login():
    """เข้าสู่ระบบ"""
    data = request.get_json()

    if not data or not data.get('email') or not data.get('password'):
        return validation_error('Email and password are required.')

    user = User.query.filter_by(email=data['email']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid email or password.'}), 401

    if user.account_status != 'active':
        return jsonify({'message': 'This account has been suspended. Please contact support.'}), 403

    access_token = create_access_token(identity=user.id)

    return success_response(
        {'access_token': access_token, 'user': user.to_dict()},
        message='Signed in successfully.'
    )


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน"""
    user, error = get_current_active_user()
    if error:
        return error

    return jsonify(user.to_dict()), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """อัปเดตข้อมูลโปรไฟล์"""
    user, error = get_current_active_user()
    if error:
        return error

    data = request.get_json()

    updatable_fields = ['full_name', 'phone', 'location', 'profile_image', 'bio']
    for field in updatable_fields:
        if field in data:
            setattr(user, field, data[field])

    db.session.commit()

    return success_response(
        {'user': user.to_dict()},
        message='Profile updated successfully.'
    )


@auth_bp.route('/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """ดึงข้อมูลผู้ใช้"""
    user = User.query.get(user_id)

    if not user:
        return not_found_error('User')

    return jsonify(user.to_dict()), 200
