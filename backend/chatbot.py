import os
import warnings
from dotenv import load_dotenv

from embeddings import get_embeddings
from langchain_groq import ChatGroq
from langchain_pinecone import PineconeVectorStore

warnings.filterwarnings("ignore")
load_dotenv()

chat_history = {}

def initialize_chatbot(user_index, collection_name):
    """Initialize chatbot for a specific user's index."""
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=os.getenv("GOOGLE_API_KEY"))
    
    vectorstore = PineconeVectorStore(
        index_name=user_index, embedding=embeddings, namespace=collection_name
    )
    
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})  # Retrieve top 5 documents

MAX_RETRIEVER_K = 2
MAX_DOCS_FOR_CONTEXT = 2
MAX_CHARS_PER_DOC = 1000

# ✅ ONE embedding model for EVERYTHING

def query_pinecone(query_text, user_index, collection_name):

    if user_index not in chat_history:
        chat_history[user_index] = {}

    if collection_name not in chat_history[user_index]:
        chat_history[user_index][collection_name] = []

    # Pinecone vector store
    vectorstore = PineconeVectorStore(
        index_name=user_index,
        embedding=get_embeddings(),
        namespace=collection_name
    )

    # Retrieve documents
    docs_with_score = vectorstore.similarity_search_with_score(
        query_text,
        k=MAX_RETRIEVER_K
    )

    docs_with_score.sort(key=lambda x: x[1])
    docs = [doc for doc, _ in docs_with_score]

    context = "\n\n".join(
        doc.page_content[:MAX_CHARS_PER_DOC]
        for doc in docs[:MAX_DOCS_FOR_CONTEXT]
    )

    chat = ChatGroq(
        model=GROQ_MODEL,
        temperature=0,
        groq_api_key=os.getenv("GROQ_API_KEY")
    )

    prompt = f"""
Answer ONLY using the context below.
If insufficient, say you don't have enough information.

Context:
{context}

    return detailed_response
