# app/image_comparing.py
import os
import statistics
import time
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from flask import Blueprint, request, jsonify
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from app.models import VerificationEvent, db

compare_bp = Blueprint("compare", __name__)

MODEL = "gemini-2.5-flash"
MAX_COMPARE_IMAGE_BYTES = 8 * 1024 * 1024
COMPARE_RATE_LIMIT = 30
COMPARE_RATE_WINDOW_SECONDS = 60 * 60
_compare_hits = {}


def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def _check_rate_limit():
    now = time.time()
    key = request.remote_addr or "unknown"
    hits = [
        hit for hit in _compare_hits.get(key, [])
        if now - hit < COMPARE_RATE_WINDOW_SECONDS
    ]
    if len(hits) >= COMPARE_RATE_LIMIT:
        _compare_hits[key] = hits
        return False
    hits.append(now)
    _compare_hits[key] = hits
    return True


def _read_image(file_storage, label):
    if not file_storage.mimetype or not file_storage.mimetype.startswith("image/"):
        return None, f"{label} must be an image file."

    data = file_storage.read(MAX_COMPARE_IMAGE_BYTES + 1)
    if not data:
        return None, f"{label} is empty."
    if len(data) > MAX_COMPARE_IMAGE_BYTES:
        return None, f"{label} must be smaller than 8 MB."

    return data, None


def _optional_user_id():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity is not None else None
    except Exception:
        return None

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


def compare_pair(client, img1_bytes: bytes, mt1: str, img2_bytes: bytes, mt2: str,
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


def compare_sides(client, listing: dict, incoming: dict, extra: str = "") -> dict:
    def run(side):
        b1, m1 = listing[side]
        b2, m2 = incoming[side]
        last_err = None
        for attempt in range(2): 
            try:
                return side, compare_pair(client, b1, m1, b2, m2, extra), None
            except Exception as e:
                last_err = str(e)
        return side, None, last_err

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
    mapping, missing, errors = {}, [], {}
    for side in SIDES:
        f = request.files.get(f"{prefix}_{side}")
        if f is None:
            missing.append(f"{prefix}_{side}")
            continue
        data, error = _read_image(f, f"{prefix}_{side}")
        if error:
            errors[f"{prefix}_{side}"] = error
            continue
        mapping[side] = (data, f.mimetype or DEFAULT_MIME)
    return mapping, missing, errors


def _is_invalid_key_error(message: str) -> bool:
    return "API_KEY_INVALID" in message or "API key not valid" in message


def _per_side_category(payload):
    for result in (payload.get("per_side") or {}).values():
        category = result.get("product_category")
        if category:
            return category
    return ""


def _per_side_list(payload, key):
    items = []
    for side, result in (payload.get("per_side") or {}).items():
        for item in result.get(key) or []:
            items.append(f"{side}: {item}")
    return items


def _per_side_attributes(payload):
    attributes = []
    for side, result in (payload.get("per_side") or {}).items():
        for attribute in result.get("matched_attributes") or []:
            attributes.append({"side": side, **attribute})
    return attributes


def _save_four_side_event(payload):
    per_side = payload.get("per_side") or {}
    if not per_side:
        return None

    event = VerificationEvent(
        source=request.form.get("source", "compare_page_four_side"),
        user_id=_optional_user_id(),
        product_id=request.form.get("product_id", type=int),
        image1_name="listing_front, listing_back, listing_left, listing_right",
        image2_name="incoming_front, incoming_back, incoming_left, incoming_right",
        verdict=payload.get("final_verdict", "REVIEW"),
        is_same_item=payload.get("final_verdict") == "SAME_ITEM",
        overall_similarity=payload.get("mean_confidence", 0),
        same_item_confidence=payload.get("min_confidence", 0),
        product_category=_per_side_category(payload),
        matched_attributes=_per_side_attributes(payload),
        distinguishing_details=_per_side_list(payload, "distinguishing_details"),
        differences=_per_side_list(payload, "differences"),
        reasoning=f"Four-side aggregate verdict: {payload.get('final_verdict', 'REVIEW')}",
    )
    db.session.add(event)
    db.session.commit()
    return event

@compare_bp.route("/compare", methods=["POST"])
@jwt_required()
def compare_images():
    if not _check_rate_limit():
        return jsonify({"error": "Too many image comparison requests. Please try again later."}), 429

    client = get_gemini_client()
    if client is None:
        return jsonify({
            "error": "GEMINI_API_KEY is not configured. Add a valid key to backend/.env and restart the backend."
        }), 503

    extra = request.form.get("prompt", "")
    has_side_payload = any(
        request.files.get(f"listing_{side}") or request.files.get(f"incoming_{side}")
        for side in SIDES
    )

    try:
        if has_side_payload:
            listing, listing_missing, listing_errors = _collect("listing")
            incoming, incoming_missing, incoming_errors = _collect("incoming")
            missing = listing_missing + incoming_missing
            validation_errors = {**listing_errors, **incoming_errors}
            if missing or validation_errors:
                return jsonify({
                    "error": "All four listing and incoming side images are required.",
                    "missing": missing,
                    "errors": validation_errors,
                }), 400

            payload = compare_sides(client, listing, incoming, extra)
            error_text = " ".join(str(value) for value in payload.get("errors", {}).values())
            if _is_invalid_key_error(error_text):
                return jsonify({
                    "error": "GEMINI_API_KEY is invalid. Add a valid key to backend/.env and restart the backend."
                }), 503

            event = _save_four_side_event(payload)
            payload["verification_event_id"] = event.id if event else None
            payload["model"] = MODEL
            return jsonify(payload)

        img1 = request.files.get("image1")
        img2 = request.files.get("image2")
        if not img1 or not img2:
            return jsonify({"error": "need image1 and image2"}), 400

        img1_bytes, img1_error = _read_image(img1, "image1")
        if img1_error:
            return jsonify({"error": img1_error}), 400
        img2_bytes, img2_error = _read_image(img2, "image2")
        if img2_error:
            return jsonify({"error": img2_error}), 400

        parsed = compare_pair(
            client,
            img1_bytes,
            img1.mimetype,
            img2_bytes,
            img2.mimetype,
            extra,
        )
        payload = parsed.model_dump()
        product_id = request.form.get("product_id", type=int)
        event = VerificationEvent(
            source=request.form.get("source", "compare_page"),
            user_id=_optional_user_id(),
            product_id=product_id,
            image1_name=img1.filename or "",
            image2_name=img2.filename or "",
            verdict=payload["verdict"],
            is_same_item=payload["is_same_item"],
            overall_similarity=payload["overall_similarity"],
            same_item_confidence=payload["same_item_confidence"],
            product_category=payload.get("product_category", ""),
            matched_attributes=payload.get("matched_attributes", []),
            distinguishing_details=payload.get("distinguishing_details", []),
            differences=payload.get("differences", []),
            reasoning=payload.get("reasoning", ""),
        )
        db.session.add(event)
        db.session.commit()
        payload["verification_event_id"] = event.id
        payload["model"] = MODEL
        return jsonify(payload)
    except Exception as e:
        db.session.rollback()
        message = str(e)
        if _is_invalid_key_error(message):
            return jsonify({
                "error": "GEMINI_API_KEY is invalid. Add a valid key to backend/.env and restart the backend."
            }), 503
        return jsonify({"error": str(e)}), 500
