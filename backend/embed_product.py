from dotenv import load_dotenv
load_dotenv()
from app import create_app
from app.models import db, Product
from app.chatbot import embed_text, product_to_text

app = create_app('development')
with app.app_context():
    products = Product.query.all()
    for p in products:
        try:
            p.embedding = embed_text(product_to_text(p))
            print(f"✓ {p.title}")
        except Exception as e:
            print(f"✗ {p.title}: {e}")
    db.session.commit()
    print(f"Done — {Product.query.filter(Product.embedding.isnot(None)).count()}/{len(products)} embedded")