# app/image_comparing.py
import os
from enum import Enum
from flask import Blueprint, request, jsonify
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

compare_bp = Blueprint("compare", __name__)

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"


# ---------- Output schema ----------
class MatchVerdict(str, Enum):
    SAME_ITEM = "SAME_ITEM"            # literally the same physical object
    SAME_PRODUCT = "SAME_PRODUCT"      # same model/SKU, but different unit
    SAME_TYPE = "SAME_TYPE"            # same category, different product
    DIFFERENT = "DIFFERENT"            # unrelated


class AttributeMatch(BaseModel):
    attribute: str = Field(description="What was compared, e.g. 'brand', 'color', 'logo', 'wear marks'")
    image1_value: str = Field(description="What this attribute looks like in image 1")
    image2_value: str = Field(description="What this attribute looks like in image 2")
    matches: bool


class ComparisonResult(BaseModel):
    verdict: MatchVerdict
    is_same_item: bool = Field(description="True only if this is the exact same physical object, not just same model")
    overall_similarity: int = Field(description="0-100 overall visual similarity")
    same_item_confidence: int = Field(description="0-100 confidence it is the SAME physical item")
    product_category: str = Field(description="Best guess of the product category")
    matched_attributes: list[AttributeMatch]
    distinguishing_details: list[str] = Field(description="Unique marks/wear/damage/serials used to judge same-item vs same-model")
    differences: list[str]
    reasoning: str = Field(description="Short explanation of the verdict")


# ---------- Prompt ----------
SYSTEM_PROMPT = """You are a product verification expert for a second-hand marketplace.
You are given TWO images. Determine the relationship between the items shown.

Be precise about the difference between:
- SAME_ITEM: the exact same physical object (same unique wear, scratches, serial numbers,
  stains, reflections, background hints, or one-of-a-kind markings).
- SAME_PRODUCT: identical model/SKU but clearly a different physical unit
  (e.g. two brand-new units of the same phone).
- SAME_TYPE: same category but different product (e.g. two different running shoes).
- DIFFERENT: unrelated items.

To decide SAME_ITEM vs SAME_PRODUCT, focus on NON-reproducible details:
unique scratches, dents, dirt patterns, sticker placement, handwriting, serial numbers,
wear on specific corners, lighting/background that implies the same photo session.

Compare key attributes (brand, model, color, shape, logos, text, condition, unique marks).
Score conservatively: only say is_same_item=true when distinguishing details actually line up,
not just because the model matches.

Return your analysis strictly in the required JSON schema."""


@compare_bp.route("/compare", methods=["POST"])
def compare_images():
    img1 = request.files.get("image1")
    img2 = request.files.get("image2")
    if not img1 or not img2:
        return jsonify({"error": "need image1 and image2"}), 400

    extra = request.form.get("prompt", "")
    user_prompt = SYSTEM_PROMPT + (f"\n\nAdditional context: {extra}" if extra else "")

    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=[
                user_prompt,
                types.Part.from_bytes(data=img1.read(), mime_type=img1.mimetype),
                types.Part.from_bytes(data=img2.read(), mime_type=img2.mimetype),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ComparisonResult,
            ),
        )
        # resp.parsed is a ComparisonResult instance; resp.text is the raw JSON string
        return jsonify(resp.parsed.model_dump())
    except Exception as e:
        return jsonify({"error": str(e)}), 500