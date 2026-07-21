from flask import Flask, request, jsonify
import os
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from chatbot import * 
from ingestion import * 
from pinecone_utils import *  
from utils import sanitize_index_name
from flask_cors import CORS  
import logging

# Set up logging globally
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)  # Create logger

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
load_dotenv()
os.makedirs("uploads", exist_ok=True)
SUPPORTED_UPLOAD_TYPES = tuple(sorted(get_supported_extensions()))

@app.route("/", methods=["GET"])
def home():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "message": "Cook GPT API is running"
    })

@app.route("/upload", methods=["POST"])
def upload_file():
    user = request.form.get("user")
    collection = request.form.get("collection")
    if not user:
        return jsonify({"error": "User identifier is required"}), 400
    if not collection:
        return jsonify({"error": "Collection identifier is required"}), 400
    
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    safe_filename = secure_filename(file.filename)
    if not safe_filename:
        return jsonify({"error": "Invalid filename"}), 400
    if not is_supported_file(safe_filename):
        return jsonify({
            "error": (
                "Unsupported file type. Supported extensions: "
                + ", ".join(SUPPORTED_UPLOAD_TYPES)
            )
        }), 400

    file_path = os.path.join("uploads", safe_filename)
    try:
        file.save(file_path)

        # Ensure user has a Pinecone index and ingest file
        try:
            create_pinecone_index(user)
            success, message = ingest_file(file_path, user, collection)
            if not success:
                logger.error(f"Ingestion failed: {message}")
                return jsonify({"error": message}), 500
            return jsonify({"message": "File processed and stored successfully", "vector_ids": message}), 200
        except Exception as e:
            logger.exception("Error during index creation or ingestion")
            # attempt to remove the uploaded file on failure
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception:
                pass
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.exception("Failed to save uploaded file")
        return jsonify({"error": f"Failed to save file: {e}"}), 500

@app.route("/query", methods=["POST"])
def query():
    data = request.get_json()
    user = data.get("user")
    collection = data.get("collection")
    query_text = data.get("query", "")
    
    if not user:
        return jsonify({"error": "User identifier is required"}), 400
    if not collection:
        return jsonify({"error": "Collection identifier is required"}), 400
    if not query_text:
        return jsonify({"error": "Query text is required"}), 400
    
    try:
        logger.debug(f"Querying Pinecone with user: {user}, collection: {collection}, query: {query_text}")
        index_name = sanitize_index_name(user)
        response = query_pinecone(query_text, index_name, collection)
        logger.debug(f"Query response: {response}")
        return jsonify(response)  # Return detailed response
    except Exception as e:
        logger.error(f"Error querying Pinecone: {e}")
        return jsonify({"error": str(e)}), 500
    
@app.route("/index-info", methods=["GET"])
def get_index_info():
    """Retrieve metadata about the user's Pinecone index (namespaces, files, etc.)."""
    user = request.args.get("user")
    if not user:
        return jsonify({"error": "User identifier is required"}), 400

    try:
        index_info = get_pinecone_index_info(user)
        # Return a plain dict; Flask will convert it to JSON response.
        return index_info, 200
    except Exception as e:
        logger.exception("Error fetching index info")
        return jsonify({"error": str(e)}), 500

@app.route("/delete", methods=["POST"])
def delete_file():
    """Delete vectors associated with a specific file in a namespace for a user."""
    data = request.get_json()
    user = data.get("user")
    namespace = data.get("collection")
    filename = data.get("filename")
    
    if not user:
        return jsonify({"error": "User identifier is required"}), 400
    if not namespace:
        return jsonify({"error": "Namespace identifier is required"}), 400
    # if not filename:
        # return jsonify({"error": "Filename is required"}), 400
    
    try:
        success, message = delete_file_vectors(user, namespace, filename)
        if not success:
            return jsonify({"error": message}), 404
        return jsonify({"message": message})
    except Exception as e:
        print(f"Error deleting file: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    os.makedirs("uploads", exist_ok=True)
    app.run(debug=True)    
