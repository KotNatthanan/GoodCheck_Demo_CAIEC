"""
Global error handlers and error response helpers
"""
from flask import jsonify


def register_error_handlers(app):
    """Register global error handlers on the Flask app."""

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'Bad Request',
            'message': str(error.description) if hasattr(error, 'description') else 'Invalid request.'
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'error': 'Unauthorized',
            'message': 'Please sign in first.'
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'error': 'Forbidden',
            'message': 'You do not have permission to access this resource.'
        }), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'Not Found',
            'message': 'The requested resource was not found.'
        }), 404

    @app.errorhandler(409)
    def conflict(error):
        return jsonify({
            'error': 'Conflict',
            'message': str(error.description) if hasattr(error, 'description') else 'This record already exists.'
        }), 409

    @app.errorhandler(413)
    def payload_too_large(error):
        return jsonify({
            'error': 'Payload Too Large',
            'message': 'The uploaded file is too large. Please upload an image smaller than 8 MB.'
        }), 413

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An internal server error occurred.'
        }), 500


# --- Response helpers ---

def validation_error(message, field=None):
    """Return a 400 validation error response."""
    body = {'message': message}
    if field:
        body['field'] = field
    return jsonify(body), 400


def not_found_error(resource='resource'):
    """Return a 404 not-found response."""
    return jsonify({'message': f'{resource} not found.'}), 404


def unauthorized_error(message='Unauthorized'):
    """Return a 403 unauthorized response."""
    return jsonify({'message': message}), 403


def success_response(data, message=None, status=200):
    """Return a standard success response."""
    body = {}
    if message:
        body['message'] = message
    if isinstance(data, dict):
        body.update(data)
    else:
        body['data'] = data
    return jsonify(body), status
