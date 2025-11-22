import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { CANCEL_SUBSCRIPTION } from "../graphql/mutations";

export default function SettingsPanel({
  showSettings,
  setShowSettings,
  selectedLanguage,
  setSelectedLanguage,
  authToken,
  isSubscribed,
  checkoutLoading,
  initiateCheckout,
  handleLogout,
  usageCount,
  usageLoading,
  setToastMessage,
}) {
  if (!showSettings) return null;

  const [confirmMessage, setConfirmMessage] = useState(null);
  const [cancelSubscription, { loading: cancelLoading }] = useMutation(CANCEL_SUBSCRIPTION);

  const handleCancelClick = () => {
    setConfirmMessage(
      "Are you sure you want to cancel your subscription? You'll retain access until the end of your billing cycle."
    );
  };

  const handleModalConfirm = async () => {
    setConfirmMessage(null);
    try {
      const res = await cancelSubscription();
      setToastMessage(res.data.cancelSubscription);
    } catch (err) {
      setToastMessage("Error cancelling subscription");
    }
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full bg-white shadow-lg z-50 animate-slide-in p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-bold mb-4">Settings</h2>

        <label className="block mb-2 text-sm font-semibold">Select Language</label>
        <select
          value={selectedLanguage}
          onChange={(e) => {
            const lang = e.target.value;
            setSelectedLanguage(lang);
            chrome.storage.local.set({ preferredLanguage: lang });
            setToastMessage(`Language set to ${lang}`);
          }}
          className="w-full p-2 border border-gray-300 rounded-lg"
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
        </select>

        <button
          onClick={() => setShowSettings(false)}
          className="absolute top-2 right-2 text-gray-500 hover:text-black"
        >
          ❌
        </button>

        {authToken && (
          <>
            {!isSubscribed && (
              <button
                onClick={async () => {
                  try {
                    await initiateCheckout();
                    setToastMessage("Redirecting to payment page...");
                  } catch (err) {
                    setToastMessage("Error starting subscription");
                  }
                }}
                disabled={checkoutLoading}
                className="mt-4 w-full bg-yellow-400 text-black py-2 rounded-lg font-semibold hover:bg-yellow-500 transition"
              >
                {checkoutLoading ? "Redirecting..." : "🔓 Upgrade to Unlock Instagram"}
              </button>
            )}

            <button
              onClick={() => {
                handleLogout();
                setToastMessage("Signed out successfully");
              }}
              className="mt-4 w-full bg-red-600 text-white py-2 rounded-lg shadow hover:bg-red-700"
            >
              Sign Out
            </button>

            {isSubscribed && !usageLoading && (
              <div className="mt-4 text-sm text-center text-gray-700">
                🔢 API Usage: <strong>{usageCount}</strong> / 8000 tokens
                {usageCount >= 6000 && (
                  <p className="text-red-600 mt-1 font-semibold">
                    ⚠️ You're nearing your monthly limit!
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {authToken && isSubscribed && (
        <div className="mt-8 text-center">
          <button
            onClick={handleCancelClick}
            disabled={cancelLoading}
            className="mt-4 text-xs px-3 py-1 border border-gray-400 text-gray-600 rounded hover:bg-gray-200 transition"
          >
            {cancelLoading ? "Cancelling..." : "Cancel Subscription"}
          </button>
        </div>
      )}

      {/* Render Confirm Modal */}
      {confirmMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80">
            <p className="text-sm text-gray-700 mb-4">{confirmMessage}</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmMessage(null)}
                className="text-sm px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
