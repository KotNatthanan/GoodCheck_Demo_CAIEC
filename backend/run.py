import os
from dotenv import load_dotenv

# Load environment variables FIRST, before importing the app
load_dotenv()

from app import create_app
from app.models import db, User, Product

# Create Flask app
app = create_app(os.getenv('FLASK_ENV', 'development'))

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Product': Product}

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    app.run(debug=True, host='0.0.0.0', port=port)