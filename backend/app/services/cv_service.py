"""CV Intelligence Service — Extracts structured profiles from resumes."""
import logging
import io
import json
import pypdf
from google import genai
from pydantic import BaseModel, Field
from typing import List

from app.config import get_settings

logger = logging.getLogger(__name__)

class CVProjectExtracted(BaseModel):
    name: str = Field(description="Name of the project or employer")
    description: str = Field(description="Brief 1-2 sentence description of what was built or achieved")
    year: str = Field(description="Year or date range")

class CVExtractionResult(BaseModel):
    skills: List[str] = Field(description="List of technical skills and tools")
    projects: List[CVProjectExtracted] = Field(description="List of relevant projects or work experiences")
    years_of_experience: int = Field(description="Estimated total years of professional experience")
    education: str = Field(description="Highest degree or relevant education")

class CVService:
    def __init__(self):
        settings = get_settings()
        self.client = genai.Client(api_key=settings.gemini_api_key)
        # Using flash for fast structural extraction
        self.model = "gemini-2.5-flash"

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """Extract raw text from PDF bytes."""
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text
        except Exception as e:
            logger.error(f"Failed to extract PDF text: {e}")
            raise ValueError(f"Invalid PDF file: {str(e)}")

    def parse_cv_to_structured_data(self, cv_text: str) -> dict:
        """Use Gemini to extract structured fields from raw CV text."""
        prompt = f"Extract the candidate's professional profile from this resume text. Be concise.\n\nRESUME TEXT:\n{cv_text}"
        
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": CVExtractionResult,
                    "temperature": 0.1
                }
            )
            # Parse the JSON response
            data = json.loads(response.text)
            return data
        except Exception as e:
            logger.error(f"Gemini CV extraction failed: {e}")
            raise RuntimeError("Failed to parse CV with AI")

cv_service = CVService()
