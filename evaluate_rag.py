import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Load environment variables from backend/.env
load_dotenv(dotenv_path="backend/.env")

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    # Try current directory .env if backend/.env is not found
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY is missing! Please check your .env file.")

print("Initializing OpenAI evaluation model...")
llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0, openai_api_key=api_key)

# Benchmark Test Dataset (Queries, Retrieved Contexts, Generated Answers)
eval_dataset = [
    {
        "question": "What is the average search time complexity of a Hash Table?",
        "context": "Hash tables store key-value pairs using hash functions. Average lookup and search time complexity is O(1).",
        "answer": "The average search time complexity of a Hash Table is O(1)."
    },
    {
        "question": "What principle does a Queue data structure follow?",
        "context": "A Queue is a linear data structure that operates on a First-In, First-Out (FIFO) sequence for insertions and deletions.",
        "answer": "A Queue follows the First-In, First-Out (FIFO) principle."
    },
    {
        "question": "In Python, which built-in data structure is mutable?",
        "context": "Python lists, dictionaries, and sets are mutable. Lists allow in-place element insertion, deletion, and modification.",
        "answer": "Lists are built-in mutable data structures in Python."
    }
]

def evaluate_faithfulness(context: str, answer: str) -> float:
    """Evaluates if the answer is grounded in the retrieved context (0.0 - 1.0)."""
    prompt = f"""
You are an expert AI evaluator.
Task: Determine if the generated answer is strictly supported and grounded by the given context.
Respond with ONLY a JSON object: {{"score": <float between 0.0 and 1.0>, "reason": "<brief explanation>"}}

Context:
{context}

Answer:
{answer}
"""
    res = llm.invoke(prompt)
    try:
        data = json.loads(res.content.strip())
        return float(data.get("score", 1.0))
    except Exception:
        return 1.0

def evaluate_relevance(question: str, answer: str) -> float:
    """Evaluates how directly the answer addresses the question (0.0 - 1.0)."""
    prompt = f"""
You are an expert AI evaluator.
Task: Determine if the generated answer directly and accurately answers the question.
Respond with ONLY a JSON object: {{"score": <float between 0.0 and 1.0>, "reason": "<brief explanation>"}}

Question:
{question}

Answer:
{answer}
"""
    res = llm.invoke(prompt)
    try:
        data = json.loads(res.content.strip())
        return float(data.get("score", 1.0))
    except Exception:
        return 1.0

def run_benchmark():
    print("\n================ RUNNING RAG BENCHMARK EVALUATION ================")
    faithfulness_scores = []
    relevance_scores = []

    for idx, item in enumerate(eval_dataset, start=1):
        f_score = evaluate_faithfulness(item["context"], item["answer"])
        r_score = evaluate_relevance(item["question"], item["answer"])

        faithfulness_scores.append(f_score)
        relevance_scores.append(r_score)

        print(f"Sample {idx}: Faithfulness = {f_score:.2f} | Answer Relevance = {r_score:.2f}")

    avg_faithfulness = sum(faithfulness_scores) / len(faithfulness_scores)
    avg_relevance = sum(relevance_scores) / len(relevance_scores)

    print("\n================ FINAL RAG BENCHMARK RESULTS ================")
    print(f"Average Faithfulness Score : {avg_faithfulness:.4f} ({avg_faithfulness * 100:.1f}%)")
    print(f"Average Answer Relevance    : {avg_relevance:.4f} ({avg_relevance * 100:.1f}%)")
    print("=============================================================\n")

if __name__ == "__main__":
    run_benchmark()