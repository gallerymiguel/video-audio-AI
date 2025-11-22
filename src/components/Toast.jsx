// components/Toast.js

export default function Toast({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in">
      {message}
      <button onClick={onClose} className="ml-2 text-sm text-gray-300 hover:text-white">
        ✖
      </button>
    </div>
  );
}
