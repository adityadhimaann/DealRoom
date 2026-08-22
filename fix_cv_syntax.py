with open('/Users/aditya/Downloads/DealRoom/backend/app/services/cv_service.py', 'r') as f:
    code = f.read()

# Fix unterminated string
target = """                proj_bullets = ""
                if isinstance(data.get("projects"), list):
                    for p in data["projects"]:
                        if isinstance(p, dict):
                            proj_bullets += f"- **{p.get('name', 'Key Project')}** ({p.get('year', 'Recent')}): {p.get('description', 'Delivered production features and system architecture.')}\\n"
                
                fallback_summary = f"{name} is an accomplished {role} with over {exp} years of verified industry experience in {edu}.\\n\\n### Core Competencies & Architecture Strengths:\\n{skills_str}\\n\\n### Featured Deliverables & Project Scope:\\n{proj_bullets or '- Architected scalable cloud services and modern full-stack web applications.'}\\nReady to deliver end-to-end technical leadership, code reviews, and milestone execution under agreed commercial terms."
                data["summary"] = fallback_summary"""

# Replace with properly escaped string
clean_summary_block = '''                proj_bullets = ""
                if isinstance(data.get("projects"), list):
                    for p in data["projects"]:
                        if isinstance(p, dict):
                            p_name = p.get("name", "Key Project")
                            p_yr = p.get("year", "Recent")
                            p_desc = p.get("description", "Delivered production features and system architecture.")
                            proj_bullets += f"- **{p_name}** ({p_yr}): {p_desc}\\n"
                
                bullets = proj_bullets if proj_bullets else "- Architected scalable cloud services and modern full-stack web applications."
                data["summary"] = f"{name} is an accomplished {role} with over {exp} years of verified industry experience in {edu}.\\n\\n### Core Competencies & Architecture Strengths:\\n{skills_str}\\n\\n### Featured Deliverables & Project Scope:\\n{bullets}\\nReady to deliver end-to-end technical leadership, code reviews, and milestone execution under agreed commercial terms."'''

# Replace whatever was in that block
code = re.sub(r'proj_bullets = ""[\s\S]*?data\["summary"\] = fallback_summary', clean_summary_block, code)

with open('/Users/aditya/Downloads/DealRoom/backend/app/services/cv_service.py', 'w') as f:
    f.write(code)

print("Fixed syntax in cv_service.py")
