import axios from "axios";
import { useEffect, useState, useContext } from "react";
import { useUser } from "@clerk/clerk-react";
import { SelectedCollectionContext } from "../../context/SelectedContext"; // Ensure this path is correct
import Loader from "./Loader";
const API_URL = "https://cook-backend-8gfj.onrender.com";

export default function Sidebar() {
  const context = useContext(SelectedCollectionContext);
  if (!context) {
    throw new Error(
      "Sidebar must be used within a SelectedCollectionContext.Provider"
    );
  }

  const { selected, setSelected } = context; // Use context here
  const [collectionName, setCollectionName] = useState([]);
  const [collectionsData, setCollectionsData] = useState({});
  const [expandedCollection, setExpandedCollection] = useState(null);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const { isSignedIn, user, isLoaded } = useUser();
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    if (collectionName.length === 0) {
      setContentLoading(true);
    }
  }, [collectionName]);

  const deleteCollection = async (collection) => {
    if (!user || !collection) {
      alert("Please provide both user and collection.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: user.username,
          collection: collection,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      alert(data.message); // Notify the user
      console.log("Success:", data.message);
    } catch (error) {
      console.error("Error deleting collection:", error);
      alert("Failed to delete collection: " + error.message);
    }
  };

  const userCollection = async () => {
    try {
      const response = await axios.get(`${API_URL}/index-info`, {
        params: {
          user: user?.username,
        },
      });

      const namespaces = response.data.namespaces
        ? Object.keys(response.data.namespaces)
        : [];
      console.log(response);

      setCollectionName(namespaces); // Set the keys (e.g., ["resume"]) as the collection names
      setCollectionsData(response.data.namespaces); // Update collectionsData with the namespaces object
      setContentLoading(false); // Stop loading once data is fetched
    } catch (e) {
      console.log("error", e);
      setContentLoading(false); // Stop loading even if there's an error
    }
  };

  useEffect(() => {
    if (user) {
      userCollection();
    }
  }, [user]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !newCollectionName.trim()) {
      setMessage("Both file and collection name are required.");
      return;
    }

    setLoading(true);
    setMessage("Uploading file...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user", user?.username);
    formData.append("collection", newCollectionName);

    try {
      await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setNewCollectionName("");
      setMessage("File uploaded successfully!");
      alert("File uploaded successfully!");

      // Poll the server for updated collections for 5 seconds
      const interval = setInterval(() => {
        userCollection();
      }, 1000); // Call userCollection every 1 second

      setTimeout(() => {
        clearInterval(interval); // Stop polling after 5 seconds
      }, 5000);
    } catch (error) {
      setMessage(
        `Upload failed: ${error.response?.data?.error || error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = (collection) => {
    if (expandedCollection === collection) {
      setExpandedCollection(null);
    } else {
      setExpandedCollection(collection);
    }
  };

  const getFilesForCollection = (collection) => {
    if (collectionsData[collection] && collectionsData[collection].files) {
      return Object.keys(collectionsData[collection].files); // Return file names
    }
    return [];
  };

  return (
    <div className="w-72 h-screen bg-[#181818] p-6 mb-7 border-r border-[#2d2d2d] flex flex-col shadow-lg rounded-3xl overflow-hidden">
      {/* Sidebar Header */}
      <h2 className="text-xl font-bold text-blue-500 uppercase tracking-wide pb-4 border-b-2 border-gray-600">
        Collections
      </h2>

      {/* Collections List */}
      <div className="flex flex-col gap-3 mt-5 mb-5 flex-grow overflow-y-auto max-h-[60vh]">
        {contentLoading ? (
          <Loader />
        ) : (
          collectionName.map((collection, index) => (
            <div key={index} className="rounded-lg transition-all duration-300">
              <div
                className={`p-3 rounded-lg cursor-pointer flex justify-between items-center ${
                  selected === collection
                    ? "bg-[#292929] text-[#ff8c42] font-medium shadow-sm"
                    : "bg-transparent hover:bg-[#252525] text-gray-300"
                }`}
                onClick={() => setSelected(collection)}
              >
                <h2>{collection}</h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown(collection);
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-200 transition-all duration-200"
                  title="Show Files"
                >
                  {expandedCollection === collection ? "▲" : "▼"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown(collection);
                    if (
                      window.confirm(
                        `Are you sure you want to delete "${collection}"?`
                      )
                    ) {
                      deleteCollection(collection);
                      console.log(`Deleted collection: ${collection}`);
                    }
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-200 transition-all duration-200"
                  title="Show Files"
                >
                  Del
                </button>
              </div>

              {/* Files Dropdown */}
              {expandedCollection === collection && (
                <div className="ml-4 pl-2 mt-1 border-l-2 border-[#3d3d3d] text-sm">
                  {getFilesForCollection(collection).length > 0 ? (
                    getFilesForCollection(collection).map(
                      (fileName, fileIndex) => (
                        <div
                          key={fileIndex}
                          className="py-2 text-gray-400 hover:text-gray-200 cursor-pointer"
                        >
                          {fileName}
                        </div>
                      )
                    )
                  ) : (
                    <div className="py-2 text-gray-500 italic">No files</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Upload Section (Fixed to the Bottom with Bottom Margin) */}
      <div className="mt-6 p-4 rounded-lg bg-[#292929] shadow-lg">
        <h2 className="text-xl font-extrabold text-indigo-600 mb-3">
          Upload Document
        </h2>

        {/* Collection Name Input */}
        <input
          type="text"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="Enter collection name"
          className="w-full p-2 text-gray-100 bg-[#1e1e1e] border border-[#383838] rounded-lg focus:border-[#ff8c42] focus:outline-none placeholder-gray-500"
        />

        {/* File Upload Button */}
        <div className="flex items-center space-x-3 mt-3">
          <label className="flex items-center justify-center bg-[#383838] hover:bg-[#444444] text-gray-200 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200">
            📁
            <input type="file" className="hidden" onChange={handleFileChange} />
          </label>
          <span className="text-sm text-gray-400">
            {file ? file.name : "No file selected"}
          </span>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={loading || !file || !newCollectionName.trim()}
          className={`mt-3 w-full py-2 text-center font-medium rounded-lg transition-all duration-200 ${
            loading || !file || !newCollectionName.trim()
              ? "bg-gray-600 cursor-not-allowed text-gray-400"
              : "bg-gradient-to-r from-indigo-500 to-teal-500 hover:bg-gradient-to-r hover:from-indigo-400 hover:to-teal-400 text-white"
          }`}
        >
          {loading ? (
            <span className="text-yellow-300">Uploading...</span>
          ) : (
            <span className="text-white">Upload</span>
          )}
        </button>

        {message && <p className="text-xs text-gray-300 mt-2">{message}</p>}
      </div>
    </div>
  );
}
