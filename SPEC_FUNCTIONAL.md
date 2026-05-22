# MagnetFinder - Functional Specifications

## 1. Project Vision
MagnetFinder is a lightweight, portable, and private torrent meta-search engine. It aggregates results from multiple public trackers (APIs and Scraping) into a single, clean, mobile-friendly interface.

## 2. Target Audience
- Users looking for a fast, ad-free search experience.
- Users who want to host their own search tool locally or on the cloud (Vercel).
- Mobile and Desktop users (Responsive Design).

## 3. Core Features

### 3.1. Authentication
- **Locked Access:** The app is protected by a simple password overlay.
- **Default Password:** `bob`
- **Persistence:** Auth state is saved in `localStorage`.

### 3.2. Search & Discovery
- **Multi-Engine Search:** Queries are sent concurrently to all selected engines.
- **Engine Selection:** A floating settings button (bottom-right) allows users to toggle specific engines (TPB, 1337x, YTS, Nyaa, etc.).
- **Scraping & APIs:** Combines JSON APIs (fast) and HTML Scraping (robust fallback).

### 3.3. Results Management
- **Unified List:** Results are merged and sorted.
- **Dynamic Sorting:** Client-side sorting by Seeders, Size, or Date (Newest first).
- **Pagination:** Results are limited to 50 per page for performance.
- **Human-Readable Data:** Automatic conversion of bytes to GB/MB and relative dates to YYYY-MM-DD.

### 3.4. Download Experience
- **One-Click Download:** Clicking anywhere on a result block triggers the magnet link.
- **Tracker Injection:** Automatically appends a list of 8+ high-performance public trackers to every link to ensure instant peer discovery.

### 3.5. Debugging Tool
- **Foldable Console:** A bottom bar showing real-time logs.
- **Metrics:** Response time (ms), result count per engine, and specific error messages (e.g., 403 Forbidden).

## 4. User Journey
1. User enters site -> Password Prompt.
2. User types "bob" -> Search Dashboard.
3. User configures engines via the floating ⚙️ icon.
4. User enters query -> Loading state -> Results displayed.
5. User sorts/pages through results.
6. User clicks a result -> Torrent client opens.
