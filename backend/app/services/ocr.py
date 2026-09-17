import re
from io import BytesIO

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image


def clean_ocr_text(raw_text: str) -> str:
    lines = raw_text.splitlines()
    cleaned_lines = []

    for line in lines:
        line = re.sub(r"[ \t]+", " ", line)
        line = line.strip()

        if line:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def extract_ocr(file_path: str, mime_type: str) -> dict:
    if mime_type in ["text/plain", "text/markdown"] or file_path.lower().endswith(".txt"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text = f.read()
        cleaned_text = clean_ocr_text(raw_text)
        return {
            "raw_text": raw_text,
            "cleaned_text": cleaned_text,
            "mean_word_confidence": 0.95,
            "page_count": 1,
            "ocr_engine": "plain_text",
            "language": "eng",
            "preprocessing_metadata": {
                "format": "text",
            },
        }

    images = []

    try:
        if mime_type == "application/pdf":
            with open(file_path, "rb") as pdf_file:
                pdf_bytes = pdf_file.read()
            images = convert_from_bytes(pdf_bytes, dpi=200)
        else:
            image = Image.open(file_path)
            image = image.convert("L")
            images = [image]

        raw_text_pages = []
        confidences = []
        page_count = 0

        for image in images:
            page_count += 1

            page_text = pytesseract.image_to_string(image, lang="eng")
            raw_text_pages.append(page_text)

            data = pytesseract.image_to_data(
                image,
                lang="eng",
                output_type=pytesseract.Output.DICT,
            )

            for i, conf in enumerate(data.get("conf", [])):
                try:
                    conf_value = float(conf)
                except Exception:
                    conf_value = -1.0

                word = (data.get("text", [""] * len(data.get("conf", [])))[i] or "").strip()

                if conf_value >= 0 and word:
                    confidences.append(conf_value)

        raw_text = "\n".join(raw_text_pages)
        cleaned_text = clean_ocr_text(raw_text)

        mean_confidence = 0.0
        if confidences:
            mean_confidence = sum(confidences) / len(confidences)
            mean_confidence = mean_confidence / 100.0

        return {
            "raw_text": raw_text,
            "cleaned_text": cleaned_text,
            "mean_word_confidence": mean_confidence,
            "page_count": page_count,
            "ocr_engine": "tesseract",
            "language": "eng",
            "preprocessing_metadata": {
                "pdf": mime_type == "application/pdf",
                "dpi": 200 if mime_type == "application/pdf" else None,
                "grayscale": mime_type != "application/pdf",
            },
        }
    except Exception as exc:
        # Fallback if tesseract / poppler executable not found on host
        return {
            "raw_text": "",
            "cleaned_text": "",
            "mean_word_confidence": 0.0,
            "page_count": 0,
            "ocr_engine": "tesseract_unavailable",
            "language": "eng",
            "preprocessing_metadata": {"error": str(exc)},
        }