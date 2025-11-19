import React from "react";

export default function ConfirmModal({ message, onConfirm, onCancel }) {
  if (!message) return null; // No modal unless there's a message

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80">
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-sm px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
