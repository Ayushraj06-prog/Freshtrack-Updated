# FreshTrack — Smart Kitchen Inventory & Expiry Tracker

Zero-waste Indian kitchen manager with smart expiry tracking, receipt scanning, Rasoi AI Chef, and real-time backend SQLite database.

---

## 🪟 How to Run on Windows (100% Offline Capable)

### 1. Prerequisites
- **Node.js (v20 or v22 LTS)**: Download and install the Windows installer (.msi) from [https://nodejs.org](https://nodejs.org).

### 2. Quick 1-Click Launch (Recommended)
1. Extract the downloaded `freshtrack-kitchen-app.zip` into any folder (e.g., `C:\FreshTrack` or `Downloads\freshtrack`).
2. Double-click the **`start-windows.bat`** file.
   - It will automatically run `npm install` on first launch.
   - It will boot the local SQLite database and backend server.
   - It will automatically open your default browser to `http://localhost:3000`.

---

### 3. Manual Command Line Launch (Command Prompt or PowerShell)
1. Open the extracted folder in File Explorer.
2. Click the address bar at the top, type `cmd`, and press **Enter**.
3. In the black Command Prompt window, run:
   ```cmd
   npm install
   npm run dev
   ```
4. Open your web browser and go to:
   ```
   http://localhost:3000
   ```

---

## 🔒 Offline Features Included

When running without internet:
- **SQLite Database (`data/freshtrack.db`)**: Saves all items, quantities, dates, and ₹ savings directly on your computer's hard drive.
- **Offline Receipt Parser**: Extracts items, prices, and quantities from pasted text or sample bills (Blinkit, DMart, Zepto, Reliance, Kirana) using local regex rules.
- **Offline Recipe Engine**: Matches expiring items to traditional Indian rescue recipes (Kadhi, Rasam, Bread Upma, Paneer Bhurji) without calling external APIs.
- **Offline Barcode Database**: Recognizes popular Indian staples locally.
- **Analytics & Financial Savings**: Calculates ₹ saved vs. wasted in real time.

---

## 🔑 Optional: Activating Gemini 2.5 Flash AI

If you have an internet connection and a Google Gemini API key:
1. Create a file named `.env.local` in the project folder.
2. Add your key:
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   ```
3. Restart the server. Multimodal receipt photo vision and the dynamic Rasoi AI Chef will automatically activate!
