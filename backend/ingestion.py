import os
import sys
import tempfile
import time
import uuid
from dotenv import load_dotenv
from langchain_community.document_loaders import CSVLoader, PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from pinecone import Pinecone, ServerlessSpec
from pdf2image import convert_from_path
from PIL import Image
import pytesseract
from embeddings import EMBEDDING_DIMENSION, get_embeddings

load_dotenv()
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "").strip()
if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
else:
    # Auto-detect common Windows installation paths to reduce setup friction.
    default_windows_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for candidate in default_windows_paths:
        if os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            break

# Initialize Pinecone
try:
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
except Exception as e:
    print(f"Warning: Could not initialize Pinecone: {e}")
    pc = None

from utils import sanitize_index_name

OCR_UNAVAILABLE_MARKER = "OCR unavailable"
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")
TEXT_EXTENSIONS = (".txt",)
CSV_EXTENSIONS = (".csv",)
NATIVE_AUDIO_EXTENSIONS = (".wav", ".aiff", ".aif", ".flac")
AUDIO_EXTENSIONS = NATIVE_AUDIO_EXTENSIONS + (".mp3", ".m4a", ".aac", ".ogg", ".wma")
VIDEO_EXTENSIONS = (".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v")
SUPPORTED_EXTENSIONS = (
    (".pdf",)
    + TEXT_EXTENSIONS
    + CSV_EXTENSIONS
    + IMAGE_EXTENSIONS
    + AUDIO_EXTENSIONS
    + VIDEO_EXTENSIONS
)
MEDIA_EXTENSIONS = AUDIO_EXTENSIONS + VIDEO_EXTENSIONS


class IngestionError(Exception):
    """Raised when a file cannot be converted into indexable documents."""


def create_pinecone_index(user):
    if pc is None:
        raise RuntimeError("Pinecone client not initialized. Set PINECONE_API_KEY in your .env.")

    name = sanitize_index_name(user)

    existing_indexes = []
    try:
        existing_indexes = pc.list_indexes().names()
    except Exception:
        existing_indexes = []

    if name not in existing_indexes:
        print(f"Creating Pinecone index '{name}'...")
        pc.create_index(
            name=name,
            dimension=EMBEDDING_DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )

    # wait until index is ready (with timeout to prevent hanging)
    max_wait = 60  # seconds
    waited = 0
    interval = 1
    ready = False
    
    while waited < max_wait:
        try:
            desc = pc.describe_index(name)
            
            # Handle different status formats from Pinecone SDK
            if desc is None:
                ready = False
            else:
                status_attr = getattr(desc, "status", None)
                if isinstance(status_attr, dict):
                    ready = bool(status_attr.get("ready", False))
                elif hasattr(status_attr, "get"):
                    # dict-like object
                    ready = bool(status_attr.get("ready", False))
                elif hasattr(status_attr, "ready"):
                    # object with ready attribute
                    ready = bool(getattr(status_attr, "ready", False))
                else:
                    # fallback: assume not ready
                    ready = False
            
            if ready:
                print(f"Index '{name}' is ready")
                break
                
        except Exception as e:
            print(f"Warning: error checking index status: {e}")
            ready = False
        
        time.sleep(interval)
        waited += interval
    
    if not ready:
        raise TimeoutError(f"Pinecone index '{name}' not ready after {max_wait} seconds")
    
    return name


def extract_images_from_pdf(pdf_path, output_folder="extracted_images"):
    """Extract images from a PDF and save them as separate files."""
    os.makedirs(output_folder, exist_ok=True)
    images = convert_from_path(pdf_path)
    image_paths = []
    
    for i, image in enumerate(images):
        image_path = os.path.join(output_folder, f"{os.path.basename(pdf_path)}_image_{i}.png")
        image.save(image_path, "PNG")
        image_paths.append(image_path)
    
    return image_paths

def extract_text_from_image(image_path):
    """Extract text from an image using OCR. Returns empty string if tesseract unavailable."""
    try:
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        return text.strip()
    except pytesseract.TesseractNotFoundError as e:
        print(f"Warning: Tesseract not found: {e}")
        return ""
    except Exception as e:
        print(f"Warning: Could not extract text from image (tesseract may not be installed): {e}")
        # Return empty content so we don't index non-informational placeholders.
        return ""


def get_supported_extensions():
    return SUPPORTED_EXTENSIONS


def is_supported_file(file_path):
    return os.path.splitext(file_path)[1].lower() in SUPPORTED_EXTENSIONS


def convert_media_to_wav(file_path, is_video=False):
    """Convert non-native audio/video files to a temporary wav file for transcription."""
    clip = None
    audio_clip = None
    temp_wav_path = None
    try:
        if is_video:
            from moviepy.video.io.VideoFileClip import VideoFileClip

            clip = VideoFileClip(file_path)
            audio_clip = clip.audio
        else:
            from moviepy.audio.io.AudioFileClip import AudioFileClip

            audio_clip = AudioFileClip(file_path)

        if audio_clip is None:
            raise ValueError("No audio track found in media file")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_wav_path = temp_wav.name

        audio_clip.write_audiofile(temp_wav_path, logger=None)
        return temp_wav_path
    except ImportError as e:
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)
        raise RuntimeError(
            "moviepy is required to process this audio/video format. "
            "Install backend dependencies again after updating requirements."
        ) from e
    except Exception:
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)
        raise
    finally:
        if audio_clip is not None:
            audio_clip.close()
        if clip is not None:
            clip.close()

def load_document(file_path):
    """Load a document from file."""
    normalized_path = file_path.lower()
    if normalized_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
        text_data = loader.load()
        image_paths = extract_images_from_pdf(file_path)
        return text_data, image_paths
    if normalized_path.endswith(TEXT_EXTENSIONS):
        loader = TextLoader(file_path)
        return loader.load(), []
    if normalized_path.endswith(CSV_EXTENSIONS):
        loader = CSVLoader(file_path)
        return loader.load(), []
    if normalized_path.endswith(AUDIO_EXTENSIONS):
        return transcribe_audio(file_path), []
    if normalized_path.endswith(VIDEO_EXTENSIONS):
        return transcribe_video(file_path), []
    if normalized_path.endswith(IMAGE_EXTENSIONS):
        return [Document(page_content=extract_text_from_image(file_path))], []
    raise IngestionError(
        f"Unsupported file format. Supported types: {', '.join(SUPPORTED_EXTENSIONS)}"
    )


def merge_documents(documents, max_chars=3000, metadata_factory=None):
    """Merge small documents into larger context windows."""
    merged_documents = []
    current_parts = []
    current_length = 0

    for index, doc in enumerate(documents):
        content = getattr(doc, "page_content", "").strip()
        if not content:
            continue

        projected_length = current_length + len(content) + (2 if current_parts else 0)
        if current_parts and projected_length > max_chars:
            merged_content = "\n\n".join(current_parts)
            metadata = metadata_factory(len(merged_documents), index - 1) if metadata_factory else {}
            merged_documents.append(Document(page_content=merged_content, metadata=metadata))
            current_parts = []
            current_length = 0

        current_parts.append(content)
        current_length += len(content) + (2 if current_parts else 0)

    if current_parts:
        metadata = metadata_factory(len(merged_documents), len(documents) - 1) if metadata_factory else {}
        merged_documents.append(Document(page_content="\n\n".join(current_parts), metadata=metadata))

    return merged_documents

def transcribe_audio(file_path):
    """Transcribe audio file into text using SpeechRecognition."""
    temp_wav_path = None
    try:
        import speech_recognition as sr

        normalized_path = file_path.lower()
        source_path = file_path
        if not normalized_path.endswith(NATIVE_AUDIO_EXTENSIONS):
            temp_wav_path = convert_media_to_wav(file_path, is_video=False)
            source_path = temp_wav_path

        recognizer = sr.Recognizer()
        with sr.AudioFile(source_path) as source:
            audio = recognizer.record(source)
        text = recognizer.recognize_google(audio)
        return [
            Document(
                page_content=text,
                metadata={"type": "audio", "source": os.path.basename(file_path)},
            )
        ]
    except ImportError:
        raise IngestionError(
            "speech_recognition is not available in the Python environment running the backend. "
            f"Current interpreter: {sys.executable}. "
            "Install it in that same environment with `python -m pip install SpeechRecognition`."
        )
    except sr.UnknownValueError as e:
        raise IngestionError(
            "SpeechRecognition could not detect intelligible speech in the audio track. "
            "Verify the file contains clear spoken audio."
        ) from e
    except sr.RequestError as e:
        raise IngestionError(
            "SpeechRecognition could not reach the transcription service. "
            f"Details: {e}"
        ) from e
    except Exception as e:
        error_detail = str(e).strip() or e.__class__.__name__
        raise IngestionError(f"Error transcribing audio: {error_detail}") from e
    finally:
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)


def transcribe_video(file_path):
    """Extract audio from a video file and transcribe it."""
    temp_wav_path = None
    try:
        temp_wav_path = convert_media_to_wav(file_path, is_video=True)
        documents = transcribe_audio(temp_wav_path)
        for document in documents:
            document.metadata["type"] = "video"
            document.metadata["source"] = os.path.basename(file_path)
        return documents
    except Exception as e:
        error_detail = str(e).strip() or e.__class__.__name__
        raise IngestionError(f"Error transcribing video: {error_detail}") from e
    finally:
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)

def split_text(document, chunk_size=1000, chunk_overlap=100):
    """Split document into smaller chunks."""
    try:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        return text_splitter.split_documents(document)
    except Exception as e:
        print(f"Error splitting text: {e}")
        return []


def prepare_documents_for_embedding(file_path, documents):
    """Choose chunking strategy based on file type so more context survives retrieval."""
    normalized_path = file_path.lower()

    if normalized_path.endswith(IMAGE_EXTENSIONS):
        return documents

    if normalized_path.endswith(CSV_EXTENSIONS):
        return merge_documents(
            documents,
            max_chars=4000,
            metadata_factory=lambda block_index, _: {"type": "csv", "block_index": block_index},
        )

    if normalized_path.endswith(MEDIA_EXTENSIONS):
        return split_text(documents, chunk_size=2200, chunk_overlap=300)

    return split_text(documents, chunk_size=1200, chunk_overlap=150)

def create_embeddings():
    """Create a Gemini embedding client shared across requests."""
    try:
        return GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001", 
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
    except Exception as e:
        print(f"Error creating embeddings: {e}")
        return None

def store_embeddings(texts, embeddings, user, collection, file_path):
    """Store embeddings in Pinecone with filename and unique ID in metadata."""
    index_name = sanitize_index_name(user)
    try:
        # Add filename and unique ID to metadata for each document
        for doc in texts:
            if not hasattr(doc, 'metadata'):
                doc.metadata = {}
            doc.metadata['filename'] = os.path.basename(file_path)
            doc.metadata['vector_id'] = str(uuid.uuid4())  # Unique ID for each vector
            
        vector_store = PineconeVectorStore.from_documents(
            texts, 
            embeddings, 
            index_name=index_name, 
            namespace=collection
        )
        print(f"Stored {len(texts)} embeddings in Pinecone index '{index_name}' under namespace '{collection}'")
        return [doc.metadata['vector_id'] for doc in texts]  # Return list of vector IDs
    except Exception as e:
        print(f"Error storing embeddings: {e}")
        return []
    
def ingest_file(file_path, user, collection):
    """Process and store a file's data in Pinecone."""
    try:
        create_pinecone_index(user)

        # Process file
        try:
            document, image_paths = load_document(file_path)
        except IngestionError as e:
            return False, str(e)
        except Exception as e:
            return False, f"Failed to load document: {e}"

        if not document:
            return False, (
                "No readable content was extracted from the file. "
                "For audio/video uploads, verify transcription dependencies are installed and the file contains speech."
            )

        is_image_upload = file_path.lower().endswith(IMAGE_EXTENSIONS)
        texts = prepare_documents_for_embedding(file_path, document)
        # Keep only meaningful chunks; avoid indexing empty/noise text.
        texts = [
            doc for doc in texts
            if getattr(doc, "page_content", "").strip()
            and OCR_UNAVAILABLE_MARKER.lower() not in getattr(doc, "page_content", "").lower()
        ]
        if not texts:
            if is_image_upload:
                return False, (
                    "No readable text found in image. "
                    "Install/configure Tesseract OCR (or set TESSERACT_CMD in backend .env), "
                    "then re-upload."
                )
            return False, "Failed to split document into chunks"

        print(f"Created {len(texts)} text chunks")

        # Create embeddings
        embeddings = create_embeddings()
        if embeddings is None:
            return False, "Failed to create embeddings"

        # Store text embeddings in Pinecone with filename and IDs
        vector_ids = store_embeddings(texts, embeddings, user, collection, file_path)
        
        # Process images if present
        for image_path in image_paths:
            extracted_text = extract_text_from_image(image_path)
            if not extracted_text.strip():
                print(f"Skipping image '{image_path}' due to empty/unavailable OCR text")
                continue
            image_doc = Document(
                page_content=extracted_text, 
                metadata={
                    "type": "image", 
                    "filename": os.path.basename(image_path),
                    "vector_id": str(uuid.uuid4())
                }
            )
            image_vector_ids = store_embeddings([image_doc], embeddings, user, collection, image_path)
            vector_ids.extend(image_vector_ids)
            print(f"Stored OCR-extracted text from {image_path}")

        os.remove(file_path)
        return True, f"File processed and stored successfully with vector IDs: {vector_ids}"
    except Exception as e:
        return False, f"Processed file "
