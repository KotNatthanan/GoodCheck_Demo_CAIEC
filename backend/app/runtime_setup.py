"""
Runtime schema adjustments for lightweight local development.
"""
from sqlalchemy import inspect, text

from app.models import User, db


def _add_column_if_missing(table_name, existing_columns, column_name, ddl):
    if column_name in existing_columns:
        return False

    db.session.execute(text(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}'))
    return True


def ensure_runtime_schema():
    inspector = inspect(db.engine)
    table_names = set(inspector.get_table_names())

    if 'users' in table_names:
        user_columns = {column['name'] for column in inspector.get_columns('users')}
        changed = False
        changed |= _add_column_if_missing('users', user_columns, 'is_admin', 'BOOLEAN DEFAULT 0')
        changed |= _add_column_if_missing('users', user_columns, 'account_status', "VARCHAR(20) DEFAULT 'active'")
        changed |= _add_column_if_missing('users', user_columns, 'admin_notes', "TEXT DEFAULT ''")
        changed |= _add_column_if_missing('users', user_columns, 'suspended_at', 'DATETIME')
        if changed:
            db.session.commit()

        db.session.execute(text("UPDATE users SET is_admin = COALESCE(is_admin, 0)"))
        db.session.execute(text("UPDATE users SET account_status = COALESCE(account_status, 'active')"))
        db.session.execute(text("UPDATE users SET admin_notes = COALESCE(admin_notes, '')"))
        db.session.commit()

    if 'products' in table_names:
        product_columns = {column['name'] for column in inspector.get_columns('products')}
        changed = False
        changed |= _add_column_if_missing('products', product_columns, 'moderation_status', "VARCHAR(20) DEFAULT 'approved'")
        changed |= _add_column_if_missing('products', product_columns, 'moderation_note', "TEXT DEFAULT ''")
        changed |= _add_column_if_missing('products', product_columns, 'reviewed_at', 'DATETIME')
        changed |= _add_column_if_missing('products', product_columns, 'reviewed_by', 'INTEGER')
        changed |= _add_column_if_missing('products', product_columns, 'image_urls', "TEXT DEFAULT '[]'")
        if changed:
            db.session.commit()

        db.session.execute(text("UPDATE products SET moderation_status = COALESCE(moderation_status, 'approved')"))
        db.session.execute(text("UPDATE products SET moderation_note = COALESCE(moderation_note, '')"))
        db.session.execute(text("UPDATE products SET image_urls = COALESCE(image_urls, '[]')"))
        db.session.commit()

    if 'orders' in table_names:
        order_columns = {column['name'] for column in inspector.get_columns('orders')}
        changed = False
        changed |= _add_column_if_missing('orders', order_columns, 'payment_method', "VARCHAR(20) DEFAULT 'card'")
        changed |= _add_column_if_missing('orders', order_columns, 'payment_status', "VARCHAR(20) DEFAULT 'pending'")
        changed |= _add_column_if_missing('orders', order_columns, 'payment_last4', "VARCHAR(4) DEFAULT ''")
        changed |= _add_column_if_missing('orders', order_columns, 'payment_name', "VARCHAR(120) DEFAULT ''")
        changed |= _add_column_if_missing('orders', order_columns, 'tracking_note', "TEXT DEFAULT ''")
        changed |= _add_column_if_missing('orders', order_columns, 'inspection_result', "VARCHAR(20) DEFAULT ''")
        if changed:
            db.session.commit()
        try:
            db.session.execute(text("UPDATE orders SET status = 'paid' WHERE status = 'confirmed'"))
            db.session.execute(text("UPDATE orders SET status = 'seller_shipped' WHERE status = 'shipped'"))
            db.session.execute(text("UPDATE orders SET payment_status = 'paid' WHERE status != 'pending_payment' AND (payment_status IS NULL OR payment_status = '')"))
            db.session.commit()
        except Exception:
            db.session.rollback()


def ensure_default_admin(app):
    if not app.config.get('DEBUG'):
        return

    admin = User.query.filter_by(is_admin=True).first()
    if admin:
        return

    admin_email = app.config.get('GOODCHECK_ADMIN_EMAIL', 'admin@goodcheck.io')
    admin_username = app.config.get('GOODCHECK_ADMIN_USERNAME', 'admin')
    admin_password = app.config.get('GOODCHECK_ADMIN_PASSWORD', 'Admin123!')

    existing = User.query.filter(
        (User.email == admin_email) | (User.username == admin_username)
    ).first()

    if existing:
        existing.is_admin = True
        existing.account_status = 'active'
        existing.is_verified = True
        existing.admin_notes = (existing.admin_notes or '').strip()
        db.session.commit()
        app.logger.info('Promoted existing development user to admin: %s', existing.email)
        return

    admin = User(
        username=admin_username,
        email=admin_email,
        full_name='System Administrator',
        user_type='seller',
        is_admin=True,
        is_verified=True,
        account_status='active',
        admin_notes='Auto-generated local development administrator account.',
    )
    admin.set_password(admin_password)
    db.session.add(admin)
    db.session.commit()
    app.logger.info('Created development admin account: %s', admin_email)
