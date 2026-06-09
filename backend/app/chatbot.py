import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from google import genai
from google.genai import types
from sqlalchemy import or_

from app.models import Product, Order, Review

chatbot_bp = Blueprint("chatbot", __name__)

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

POLICIES = """GoodCheck Marketplace policies:
- Every listing passes a 30-point inspection before handoff.
- Funds are held in escrow during inspection; released after the buyer confirms.
- Buyer Protection: claims can be opened after delivery if an item is not as described.
- Order flow: pending_payment → paid → seller_shipped → inspection → inspection_passed → delivered → completed.
- Support hours: Mon-Sun 09:00-22:00 ICT. Contact: hello@goodcheck.io
"""

SYSTEM_PROMPT = """You are GoodCheck's friendly marketplace assistant for pre-owned computer gear.
You help users by: answering questions about products, recommending items based on their needs,
explaining marketplace policies, and (if logged in) answering questions about their orders.

Rules:
- Use ONLY the product/order/review data provided in context. Never invent products, prices, specs, or reviews.
- When recommending, mention specific listings by title and price, and cite review sentiment if available.
- If asked about something not in the context, say you couldn't find a matching listing and suggest they browse or refine.
- Keep answers concise and helpful. Prices are in THB.
- For order questions when no order data is given, ask the user to sign in.
"""


def _format_reviews(product):
    #summarize a product's reviews.
    reviews = (
        Review.query.filter_by(product_id=product.id)
        .order_by(Review.created_at.desc())
        .limit(3)
        .all()
    )
    if not reviews:
        return "no reviews yet"
    snippets = []
    for r in reviews:
        comment = (r.comment or "").strip()
        if len(comment) > 120:
            comment = comment[:120] + "…"
        snippets.append(f'{r.rating}★ "{comment}"' if comment else f"{r.rating}★")
    return f"{product.rating}★ avg ({product.total_reviews} reviews); recent: " + " | ".join(snippets)


import math

EMBED_MODEL = "models/gemini-embedding-001"

def embed_text(text):
    resp = client.models.embed_content(model=EMBED_MODEL, contents=text)
    return resp.embeddings[0].values

def cosine(a, b):
    if not a or not b:
        return -1.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return -1.0
    return dot / (na * nb)

def product_to_text(p):
    specs = ", ".join(p.specs) if isinstance(p.specs, list) else (p.specs or "")
    return (
        f"{p.title}. Category: {p.category}. Condition: {p.condition}. "
        f"Price {p.price} THB. Location: {p.location}. "
        f"Specs: {specs}. {p.description or ''}"
    )

def _mentioned_products(reply, candidates, limit=4):
    reply_lower = (reply or "").lower()
    seen, out = set(), []
    for p in candidates:
        if p.title and p.title.lower() in reply_lower and p.id not in seen:
            seen.add(p.id)
            out.append({"id": p.id, "title": p.title, "price": p.price})
            if len(out) >= limit:
                break
    return out

def _product_context(query, top_k=6):
    products = Product.query.filter(
        Product.moderation_status == "approved",
        Product.status == "available",
        Product.embedding.isnot(None),
    ).all()

    if not products:
        return "No products are currently available in the catalog.", []

    try:
        qvec = embed_text(query)
    except Exception:
        qvec = None

    if qvec:
        ranked = sorted(products, key=lambda p: cosine(qvec, p.embedding), reverse=True)
    else:
        ranked = products  # fallback

    top = ranked[:top_k]
    lines = []
    for p in top:
        specs = ", ".join(p.specs) if isinstance(p.specs, list) else (p.specs or "")
        desc = (p.description or "").strip()
        if len(desc) > 200:
            desc = desc[:200] + "…"
        lines.append(
            f"- {p.title} | category: {p.category} | price: {p.price} THB | "
            f"condition: {p.condition} | status: {p.status} | location: {p.location} | "
            f"warranty: {p.warranty or 'none'} | specs: {specs} | "
            f"description: {desc} | reviews: {_format_reviews(p)}"
        )
    return "Most relevant listings for this query:\n" + "\n".join(lines), top

def _order_context():
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
    except Exception:
        return ""
    if not uid:
        return ""

    orders = (
        Order.query.filter(or_(Order.buyer_id == uid, Order.seller_id == uid))
        .order_by(Order.created_at.desc())
        .limit(10)
        .all()
    )
    if not orders:
        return ""

    lines = []
    for o in orders:
        title = o.product.title if o.product else f"Product #{o.product_id}"
        claim = o.buyer_claim.status if o.buyer_claim else "none"
        lines.append(
            f"- Order #{o.id} | {title} | status: {o.status} | "
            f"total: {o.total_price} THB | claim: {claim}"
        )
    return "This user's orders:\n" + "\n".join(lines)


@chatbot_bp.route("/chatbot", methods=["POST"])
def chatbot():
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    history = data.get("history") or []
    if not message:
        return jsonify({"error": "message is required"}), 400

    recent_user_msgs = [t.get("text", "") for t in history[-4:] if t.get("role") == "user"]
    search_query = " ".join(recent_user_msgs + [message])

    product_ctx, candidates = _product_context(search_query)
    order_ctx = _order_context()

    context_block = f"{POLICIES}\n\n{product_ctx}"
    if order_ctx:
        context_block += f"\n\n{order_ctx}"

    contents = [
        f"{SYSTEM_PROMPT}\n\n=== CONTEXT ===\n{context_block}\n=== END CONTEXT ==="
    ]
    for turn in history[-6:]:
        role = turn.get("role", "user")
        text = turn.get("text", "")
        contents.append(f"{role.upper()}: {text}")
    contents.append(f"USER: {message}")

    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents="\n".join(contents),
        )
        reply = resp.text
        return jsonify({"reply": reply, "products": _mentioned_products(reply, candidates)}), 200
    except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": str(e)}), 500