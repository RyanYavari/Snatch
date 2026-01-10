'use client';

import { useState } from 'react';

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [budget, setBudget] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    const imageInput = document.getElementById('image') as HTMLInputElement;
    const imageFile = imageInput.files?.[0];

    if (!imageFile) {
      setMessage({ type: 'error', text: 'Please select an image' });
      setLoading(false);
      return;
    }

    if (!budget || isNaN(Number(budget)) || Number(budget) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid budget' });
      setLoading(false);
      return;
    }

    formData.append('image', imageFile);
    formData.append('budget', budget);

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create request');
      }

      setMessage({
        type: 'success',
        text: `Request created successfully! Request ID: ${data.request.id}`,
      });
      setRequestId(data.request.id);
      
      // Reset form
      setImagePreview(null);
      setBudget('');
      if (imageInput) {
        imageInput.value = '';
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to create request',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Snatch</h1>
          <p className="text-gray-600 mb-8">Multi-Agent Swarm for Finding & Negotiating Items</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div>
              <label
                htmlFor="image"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Upload Target Image
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
                <div className="space-y-1 text-center">
                  {imagePreview ? (
                    <div className="w-full mb-4 flex justify-center">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-64 rounded-md object-contain"
                      />
                    </div>
                  ) : (
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="image"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="image"
                        name="image"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleImageChange}
                        required
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
              </div>
            </div>

            {/* Budget Input */}
            <div>
              <label
                htmlFor="budget"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Budget ($)
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  name="budget"
                  id="budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="block w-full pl-7 pr-12 py-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating Request...' : 'Create Request'}
            </button>
          </form>

          {/* Message Display */}
          {message && (
            <div
              className={`mt-6 p-4 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Request Status */}
          {requestId && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Request ID:</strong> {requestId}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                The agent swarm will process your request. Check back later for updates.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
