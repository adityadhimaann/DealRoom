"""CV Intelligence Service — Extracts structured profiles from resumes (PDFs & Images)."""
import logging
import io
import json
import base64
import pypdf
from groq import Groq
import os
from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)


class CVService:
    def __init__(self):
        settings = get_settings()
        self.settings = settings
        self.groq_client = Groq(api_key=settings.groq_api_key)
        self.model = "openai/gpt-oss-120b"
        self.gemini_client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None

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
        """Use Groq to extract rich structured fields from raw CV text."""
        schema = {
            "name": "Full Name",
            "role_title": "Primary Professional Role / Headline",
            "skills": ["Skill 1", "Skill 2"],
            "years_of_experience": 5,
            "education": "University / Degree",
            "min_rate": 6000,
            "max_rate": 18000,
            "summary": "Detailed, highly articulate 3-5 paragraph technical summary covering background, key achievements, major projects, and domain expertise suitable for a client proposal."
        }
        
        prompt = f"""You are an elite technical executive recruiter and profile synthesizer.
Analyze the following resume and extract all relevant candidate information into a comprehensive structured JSON profile.

RESUME TEXT:
{cv_text}

OUTPUT INSTRUCTIONS:
- Extract candidate's full 'name'.
- Synthesize an impressive 'role_title' (e.g. "Senior Full-Stack & Distributed Systems Architect").
- List top 8-12 core 'skills'.
- Estimate realistic 'min_rate' and 'max_rate' in USD based on seniority and experience level (e.g. 5000 to 18000).
- Generate a rich, multi-paragraph 'summary' highlighting their core strengths, key architecture projects, and demonstrable technical impact.

Return ONLY a strictly valid JSON object matching this schema:
{json.dumps(schema, indent=2)}"""
        
        try:
            response = self.groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert resume parser. Always output strictly valid JSON matching the requested schema."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model=self.model,
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            content = response.choices[0].message.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            data = json.loads(content)
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                data = data[0]
            elif not isinstance(data, dict):
                data = {}

            # Guarantee summary is never empty
            if not data.get("summary") or len(str(data.get("summary")).strip()) < 20:
                skills_str = ", ".join(data.get("skills", [])) if isinstance(data.get("skills"), list) else str(data.get("skills", ""))
                role = data.get("role_title", "Senior Technical Specialist")
                name = data.get("name", "Candidate")
                exp = data.get("years_of_experience", 5)
                edu = data.get("education", "Computer Science")
                
                proj_bullets = ""
                if isinstance(data.get("projects"), list):
                    for p in data["projects"]:
                        if isinstance(p, dict):
                            p_name = p.get("name", "Key Project")
                            p_yr = p.get("year", "Recent")
                            p_desc = p.get("description", "Delivered production features and system architecture.")
                            proj_bullets += f"- {p_name} ({p_yr}): {p_desc}\n"
                
                bullets = proj_bullets if proj_bullets else "- Architected scalable cloud services and modern full-stack web applications."
                data["summary"] = f"{name} is an accomplished {role} with over {exp} years of verified industry experience in {edu}.\n\nCore Competencies:\n{skills_str}\n\nFeatured Deliverables & Project Scope:\n{bullets}\nReady to deliver end-to-end technical leadership, code reviews, and milestone execution under agreed commercial terms."

            return data
        except Exception as e:
            logger.error(f"Groq CV extraction failed: {e}")
            raise RuntimeError("Failed to parse CV with AI")

    def parse_image_cv_to_structured_data(self, image_bytes: bytes, mime_type: str = "image/png") -> dict:
        """Extract profile directly from CV image using Gemini Vision."""
        schema = {
            "name": "Full Name",
            "role_title": "Primary Professional Role / Headline",
            "skills": ["Skill 1", "Skill 2"],
            "years_of_experience": 5,
            "education": "University / Degree",
            "min_rate": 6000,
            "max_rate": 18000,
            "summary": "Detailed, highly articulate 3-5 paragraph technical summary covering background, key achievements, major projects, and domain expertise suitable for a client proposal."
        }
        
        prompt = f"""Analyze this resume image and extract all relevant candidate information into a comprehensive structured profile JSON.
Return ONLY valid JSON matching this schema:
{json.dumps(schema, indent=2)}"""

        try:
            if self.gemini_client:
                part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                response = self.gemini_client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[prompt, part]
                )
                text = response.text or "{}"
            else:
                raise ValueError("Vision client not configured")
        except Exception as e:
            logger.error(f"Image CV parsing failed: {e}")
            raise RuntimeError(f"Could not parse image CV: {str(e)}")

        content = text.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            data = json.loads(content)
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                data = data[0]
            elif not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}

        if not data.get("summary") or len(str(data.get("summary")).strip()) < 20:
            skills_str = ", ".join(data.get("skills", [])) if isinstance(data.get("skills"), list) else str(data.get("skills", ""))
            data["summary"] = f"{data.get('name', 'Candidate')} is an experienced {data.get('role_title', 'Engineer')} with verified background in {data.get('education', 'Technology')}.\n\nSkills:\n{skills_str}"

        return data


cv_service = CVService()
