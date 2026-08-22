import sys
sys.path.append("/Users/aditya/Downloads/DealRoom/backend")
from app.services.cv_service import cv_service

text = "Aditya Dhiman. Senior Fullstack Engineer. Skills: React, Node, Python, AWS. Projects: E-commerce platform in 2023. Education: BS Computer Science."
print(cv_service.parse_cv_to_structured_data(text))
