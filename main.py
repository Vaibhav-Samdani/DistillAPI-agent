import os
import shutil
import asyncio
import json
import re
from typing import List, TypedDict, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

from langchain_openai import ChatOpenAI
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langgraph.graph import StateGraph, END

load_dotenv()

# ==========================================
# STATE
# ==========================================

class AgentState(TypedDict, total=False):
    file_path: str
    raw_text: str
    chunks: List[str]
    summary: Dict[str, Any]
    qa_pairs: List[Dict[str, Any]]

# ==========================================
# LLM (HUNTER)
# ==========================================

llm = ChatOpenAI(
    model="openrouter/hunter-alpha",
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
    temperature=0.3
)

# ==========================================
# UTILS
# ==========================================

async def safe_invoke(chain, input_data, retries=2):
    for _ in range(retries):
        try:
            return await chain.ainvoke(input_data)
        except Exception:
            continue
    raise Exception("LLM failed after retries")

def fill_defaults(summary: dict):
    return {
        "tl_dr": summary.get("tl_dr") or "Summary unavailable.",
        "core_problem": summary.get("core_problem") or "Not clearly identified.",
        "methodology": summary.get("methodology") or ["Not specified"],
        "key_findings": summary.get("key_findings") or ["No findings extracted"],
        "strengths": summary.get("strengths") or ["Not specified"],
        "limitations": summary.get("limitations") or ["Not specified"],
        "practical_implications": summary.get("practical_implications") or "Not available"
    }

# ==========================================
# PARSERS (ROBUST REGEX IMPLEMENTATION)
# ==========================================

def parse_summary(text: str) -> Dict[str, Any]:
    """Safely extracts sections even if the LLM uses bolding or inline text."""
    # Strip out markdown bolding the LLM might hallucinate (e.g., **TLDR:**)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)

    sections = {
        "tl_dr": "", "core_problem": "", "methodology": [],
        "key_findings": [], "strengths": [], "limitations": [],
        "practical_implications": ""
    }

    headers = [
        ("TLDR:", "tl_dr", "str"),
        ("CORE PROBLEM:", "core_problem", "str"),
        ("METHODOLOGY:", "methodology", "list"),
        ("KEY FINDINGS:", "key_findings", "list"),
        ("STRENGTHS:", "strengths", "list"),
        ("LIMITATIONS:", "limitations", "list"),
        ("IMPLICATIONS:", "practical_implications", "str")
    ]

    current_key = None
    current_type = None

    for line in text.split("\n"):
        line = line.strip()
        if not line: continue

        found_header = False
        for header_text, key, expected_type in headers:
            if line.upper().startswith(header_text):
                current_key = key
                current_type = expected_type
                found_header = True
                
                # Extract text on the SAME line as the header (e.g., "TLDR: The text...")
                content = line[len(header_text):].strip()
                if content:
                    if expected_type == "list":
                        content = re.sub(r'^[-*]\s*', '', content) # Remove bullets
                        sections[current_key].append(content)
                    else:
                        sections[current_key] = content
                break

        if not found_header and current_key:
            if current_type == "list":
                content = re.sub(r'^[-*]\s*', '', line) # Remove bullets
                if content: 
                    sections[current_key].append(content)
            else:
                # Append to existing string
                sections[current_key] += " " + line if sections[current_key] else line

    return sections


def parse_qa(text: str) -> List[Dict[str, str]]:
    """Uses Regex to grab Q&A blocks reliably, ignoring extra chatty text."""
    qa_pairs = []
    
    # Matches everything after Q1: up to the next A1:
    questions = re.findall(r'Q\d*[:.](.*?)(?=A\d*[:.]|$)', text, re.DOTALL)
    # Matches everything after A1: up to the next Q2: or end of string
    answers = re.findall(r'A\d*[:.](.*?)(?=Q\d*[:.]|$)', text, re.DOTALL)

    # Zip them together safely
    for i in range(min(len(questions), len(answers))):
        q = questions[i].strip()
        a = answers[i].strip()
        if q and a:
            qa_pairs.append({"question": q, "answer": a})

    return qa_pairs[:3]

# ==========================================
# NODES
# ==========================================

async def load_pdf_node(state: AgentState) -> AgentState:
    loader = PyPDFLoader(state["file_path"])
    docs = await asyncio.to_thread(loader.load)
    raw_text = "\n".join([doc.page_content for doc in docs])
    return {"raw_text": raw_text}


async def chunk_text_node(state: AgentState) -> AgentState:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2500,
        chunk_overlap=400
    )
    chunks = await asyncio.to_thread(splitter.split_text, state["raw_text"])
    return {"chunks": chunks}


# 🔥 HUNTER-FRIENDLY SUMMARIZATION
async def summarize_node(state: AgentState) -> AgentState:
    combined_text = "\n".join(state["chunks"][:6]) 

    prompt = PromptTemplate.from_template(
        "You are an expert research assistant.\n"
        "Summarize the paper by filling out the exact headings below. Do NOT change the headings.\n\n"
        "TLDR:\n"
        "CORE PROBLEM:\n"
        "METHODOLOGY:\n"
        "KEY FINDINGS:\n"
        "STRENGTHS:\n"
        "LIMITATIONS:\n"
        "IMPLICATIONS:\n\n"
        "Use bullet points for Methodology, Key Findings, Strengths, and Limitations.\n\n"
        "PAPER TEXT:\n{text}"
    )

    chain = prompt | llm
    response = await safe_invoke(chain, {"text": combined_text})
    parsed = parse_summary(response.content)

    return {"summary": fill_defaults(parsed)}


# 🔥 QA GENERATION (NO JSON FORCING)
async def generate_qa_node(state: AgentState) -> AgentState:
    prompt = PromptTemplate.from_template(
        "Generate exactly 3 deep questions to test a reader's understanding of this paper, along with their answers.\n\n"
        "You MUST format your response strictly like this:\n"
        "Q1: [Your first question]\n"
        "A1: [Your first answer]\n\n"
        "Q2: [Your second question]\n"
        "A2: [Your second answer]\n\n"
        "Q3: [Your third question]\n"
        "A3: [Your third answer]\n\n"
        "SUMMARY:\n{summary}"
    )

    chain = prompt | llm
    response = await safe_invoke(chain, {
        "summary": json.dumps(state["summary"], indent=2)
    })

    qa_pairs = parse_qa(response.content)
    return {"qa_pairs": qa_pairs}

# ==========================================
# GRAPH & FASTAPI BOILERPLATE BELOW
# ==========================================

workflow = StateGraph(AgentState)

workflow.add_node("load_pdf", load_pdf_node)
workflow.add_node("chunk_text", chunk_text_node)
workflow.add_node("summarize", summarize_node)
workflow.add_node("generate_qa", generate_qa_node)

workflow.set_entry_point("load_pdf")

workflow.add_edge("load_pdf", "chunk_text")
workflow.add_edge("chunk_text", "summarize")
workflow.add_edge("summarize", "generate_qa")
workflow.add_edge("generate_qa", END)

app_graph = workflow.compile()


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_file(path: str):
    if os.path.exists(path):
        os.remove(path)

@app.post("/process-paper")
async def process_paper(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF supported")

    temp_path = f"temp_{file.filename}"

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    background_tasks.add_task(cleanup_file, temp_path)

    try:
        final_state = await app_graph.ainvoke({"file_path": temp_path})

        return {
            "status": "success",
            "filename": file.filename,
            "data": {
                "summary": final_state.get("summary", {}),
                "qa_pairs": final_state.get("qa_pairs", [])
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)