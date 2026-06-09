# app/image_comparing.py
import os
import statistics
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from flask import Blueprint, request, jsonify
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from flask_jwt_extended import jwt_required

compare_bp = Blueprint("compare", __name__)

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

SIDES = ["front", "back", "left", "right"]
DEFAULT_MIME = "image/jpeg"
MAX_WORKERS = 4

SAME_ITEM_MIN_CONF = 70  
SAME_PRODUCT_MEAN = 60    
DIFF_SIDES_TO_REJECT = 2   

class MatchVerdict(str, Enum):
    SAME_ITEM = "SAME_ITEM"
    SAME_PRODUCT = "SAME_PRODUCT"
    SAME_TYPE = "SAME_TYPE"
    DIFFERENT = "DIFFERENT"


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


SYSTEM_PROMPT = """You are a product verification expert for a second-hand marketplace.
You are given TWO images of the SAME SIDE of a product (e.g. both are the front).
Determine the relationship between the items shown.

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


def compare_pair(img1_bytes: bytes, mt1: str, img2_bytes: bytes, mt2: str,
                 extra: str = "") -> ComparisonResult:
    contents = [
        types.Part.from_bytes(data=img1_bytes, mime_type=mt1 or DEFAULT_MIME),
        types.Part.from_bytes(data=img2_bytes, mime_type=mt2 or DEFAULT_MIME),
    ]
    if extra:
        contents.append(f"Additional context: {extra}")

    resp = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ComparisonResult,
        ),
    )
    return resp.parsed  


def compare_sides(listing: dict, incoming: dict, extra: str = "") -> dict:
    def run(side):
        try:
            b1, m1 = listing[side]
            b2, m2 = incoming[side]
            return side, compare_pair(b1, m1, b2, m2, extra), None
        except Exception as e:
            return side, None, str(e)

    sides = [s for s in SIDES if s in listing and s in incoming]
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        results = list(ex.map(run, sides))

    per_side = {s: r for s, r, err in results if r is not None}
    errors = {s: err for s, r, err in results if err is not None}
    return aggregate(per_side, errors)


def aggregate(per_side: dict, errors: dict | None = None) -> dict:
    errors = errors or {}

    if not per_side:
        return {
            "final_verdict": "REVIEW",
            "reason": "no sides could be compared",
            "errors": errors,
            "per_side": {},
        }

    confs = [r.same_item_confidence for r in per_side.values()]
    diff_sides = [s for s, r in per_side.items()
                  if r.verdict == MatchVerdict.DIFFERENT]
    detail_sides = [s for s, r in per_side.items()
                    if r.is_same_item and r.distinguishing_details]

    if errors:
        final = "REVIEW"
    elif len(diff_sides) >= DIFF_SIDES_TO_REJECT:
        final = "DIFFERENT"
    elif min(confs) >= SAME_ITEM_MIN_CONF and len(detail_sides) >= 1:
        final = "SAME_ITEM"
    elif statistics.mean(confs) >= SAME_PRODUCT_MEAN:
        final = "SAME_PRODUCT"
    else:
        final = "REVIEW"

    return {
        "final_verdict": final,
        "min_confidence": min(confs),
        "mean_confidence": round(statistics.mean(confs)),
        "diff_sides": diff_sides,
        "detail_sides": detail_sides,
        "errors": errors,
        "per_side": {s: r.model_dump() for s, r in per_side.items()},
    }

def _collect(prefix: str):
    mapping, missing = {}, []
    for side in SIDES:
        f = request.files.get(f"{prefix}_{side}")
        if f is None:
            missing.append(f"{prefix}_{side}")
            continue
        mapping[side] = (f.read(), f.mimetype or DEFAULT_MIME)
    return mapping, missing

@compare_bp.route("/compare", methods=["POST"])
@jwt_required()
def compare_images():
    img1 = request.files.get("image1")
    img2 = request.files.get("image2")
    if not img1 or not img2:
        return jsonify({"error": "need image1 and image2"}), 400

    extra = request.form.get("prompt", "")
    try:
        result = compare_pair(
            img1.read(), img1.mimetype,
            img2.read(), img2.mimetype,
            extra,
        )
        return jsonify(result.model_dump())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@compare_bp.route("/compare/sides", methods=["POST"])
@jwt_required()
def compare_four_sides():
    listing, miss_l = _collect("listing")
    incoming, miss_i = _collect("incoming")

    missing = miss_l + miss_i
    if missing:
        return jsonify({"error": "missing images", "fields": missing}), 400

    extra = request.form.get("prompt", "")
    try:
        result = compare_sides(listing, incoming, extra)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500