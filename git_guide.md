# 🛠️ Git & GitHub Collaboration Guide — Full-Stack Client Dashboard

> **Author:** Tilak Patel  
> **Date:** April 14, 2026  
> **Purpose:** This document explains everything about how Git and GitHub were set up for this project, why certain decisions were made, and exactly what each team member needs to do to start collaborating.

---

## Table of Contents

1. [Why Do We Need Git & GitHub?](#1-why-do-we-need-git--github)
2. [How the Frontend and Backend Are Connected](#2-how-the-frontend-and-backend-are-connected)
3. [What Tilak Already Did (Setup Summary)](#3-what-tilak-already-did-setup-summary)
4. [Understanding .gitignore — Why We Ignore Certain Files](#4-understanding-gitignore--why-we-ignore-certain-files)
5. [Understanding .env.example — How We Share Secrets Safely](#5-understanding-envexample--how-we-share-secrets-safely)
6. [What Your Friend Needs To Do (Step-by-Step)](#6-what-your-friend-needs-to-do-step-by-step)
7. [The Branch Workflow — How We Write Code Without Breaking Each Other's Work](#7-the-branch-workflow--how-we-write-code-without-breaking-each-others-work)
8. [Common Git Commands Cheat Sheet](#8-common-git-commands-cheat-sheet)
9. [Common Errors & How To Fix Them](#9-common-errors--how-to-fix-them)
10. [FAQ](#10-faq)

---

## 1. Why Do We Need Git & GitHub?

### The Problem
Previously, the project was shared by physically copying the entire folder from one PC to another (via USB, WhatsApp, zip files, etc.). This causes serious problems:

- **No version tracking:** If something breaks, you can't go back to a working version.
- **No way to merge:** If two people edit the same file, you'd have to manually compare every single line to combine changes.
- **Broken environments:** The `venv` folder contains machine-specific paths (like `C:\Users\Friend\...`) that simply won't work on another PC.

### The Solution
**Git** is a tool installed on your local PC that tracks every change you make to every file. Think of it as an "infinite undo button" for your entire project.

**GitHub** is a website (cloud server) where your Git-tracked code lives online. It acts as the "central source of truth" that both teammates connect to.

**You need BOTH:**
- **Git** = the engine on your PC that packages and tracks code.
- **GitHub** = the cloud server where both PCs upload/download code.

### Do We Need CI/CD?
**No.** CI/CD (Continuous Integration/Continuous Deployment) is completely optional. It's just automated scripts that run tests whenever code is uploaded. For our workflow of merging code between two developers, GitHub's basic Pull Request system handles everything perfectly without CI/CD.

---

## 2. How the Frontend and Backend Are Connected

This is a **full-stack application** with two completely separate servers:

| Component | Technology | Runs On | Purpose |
|-----------|-----------|---------|---------|
| **Backend** | Python (FastAPI + Uvicorn) | `http://localhost:8000` | API server, database, AI logic |
| **Frontend** | React (Next.js) | `http://localhost:3000` | The visual UI you see in the browser |

### How They Talk to Each Other
The frontend knows where the backend lives because of the file `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

When you click a button in the React UI (on port 3000), it sends an HTTP request to the Python API (on port 8000). The backend processes the request, talks to the database, and sends data back to the frontend to display.

### The `uvicorn` Command Explained
When you run `uvicorn app.main:app --reload`, here's what each part means:
- **`uvicorn`** — The web server software (installed via `pip install`, lives inside `.venv/Scripts/`).
- **`app.main`** — Look inside the `app` folder, open the `main.py` file.
- **`:app`** — Inside `main.py`, find the variable named `app` (the FastAPI instance) and run it.
- **`--reload`** — Automatically restart the server whenever you save a file (development mode only).

### Running the Project (Both Servers)
You need **two separate terminal windows** running simultaneously:

**Terminal 1 — Backend:**
```bash
# From the project root folder
.\.venv\Scripts\activate
cd backend
uvicorn app.main:app --reload
```

**Terminal 2 — Frontend:**
```bash
# From the project root folder
cd frontend
npm run dev
```

Then open your browser to `http://localhost:3000`.

---

## 3. What Tilak Already Did (Setup Summary)

Here is a complete log of every action Tilak performed to set up this project for collaboration:

### 3.1 Fixed the Python Environment
The original `venv` folder was copied from a friend's PC and contained hardcoded paths that don't work on Tilak's machine. Solution:
1. Created a brand-new virtual environment: `python -m venv .venv`
2. Installed all dependencies: `pip install -r requirements.txt`
3. Fixed a missing dependency (`structlog`) that wasn't listed in `requirements.txt`.
4. Fixed a `pandas_datareader` incompatibility with the latest `pandas` by adding a graceful fallback in `backend/app/services/macro_service.py`.

### 3.2 Created the `.gitignore` File
This file tells Git which files/folders to **skip** when uploading to GitHub. See [Section 4](#4-understanding-gitignore--why-we-ignore-certain-files) for full details.

### 3.3 Created the `.env.example` File
This is a safe, empty template of the `.env` file (with all passwords removed). See [Section 5](#5-understanding-envexample--how-we-share-secrets-safely) for full details.

### 3.4 Initialized Git and Pushed to GitHub
```bash
# 1. Installed Git from https://gitforwindows.org/
# 2. Set identity
git config --global user.name "Tilak Patel"
git config --global user.email "tilakvpatel016@gmail.com"

# 3. Initialized the repository
git init

# 4. Packaged all files (respecting .gitignore)
git add .

# 5. Created the first save point (commit)
git commit -m "Initial project setup"

# 6. Set branch name to "main"
git branch -M main

# 7. Connected to the GitHub cloud repository
git remote add origin https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git

# 8. Uploaded everything to GitHub
git push -u origin main --force
```

The `--force` flag was needed because the GitHub repository was created with a default README file, and Git refused to overwrite it without explicit permission.

---

## 4. Understanding .gitignore — Why We Ignore Certain Files

The `.gitignore` file in the project root contains:

```gitignore
# Dependencies
node_modules/
.venv/
__pycache__/
*.pyc

# Environment Variables
.env
.env.local

# Database/Vector stores
*.db
*.sqlite
*.sqlite3

# Next.js Build Output
.next/
out/
build/

# OS/Editor Files
.DS_Store
.vscode/
Thumbs.db
```

### Why We Ignore Each Category

| Ignored Item | Why |
|-------------|-----|
| `node_modules/` | Contains ~400+ packages (~200MB). The `package.json` file is the "recipe" that lists them. Anyone can regenerate `node_modules` by running `npm install`. |
| `.venv/` | Contains Python packages and machine-specific paths (e.g., `C:\Users\Tilak\...`). Won't work on another PC. Regenerated via `python -m venv .venv` + `pip install -r requirements.txt`. |
| `__pycache__/` | Auto-generated compiled Python files. Regenerated automatically when Python runs. |
| `.env` / `.env.local` | Contains **SECRET API KEYS AND PASSWORDS**. If uploaded to GitHub, hackers can steal your keys. |
| `*.db` | Database files contain data, not code. Each developer has their own local database. |
| `.next/` | Auto-generated build output from Next.js. Regenerated via `npm run build`. |
| `.vscode/` | Personal editor settings. Each developer has their own preferences. |

### The Key Insight
We **DO** upload the "recipe" files that describe what's inside those ignored folders:
- `package.json` + `package-lock.json` → Describes what's inside `node_modules/`
- `requirements.txt` → Describes what's inside `.venv/`
- `.env.example` → Describes what's inside `.env` (without passwords)

---

## 5. Understanding .env.example — How We Share Secrets Safely

The `.env` file contains real API keys and passwords. It is **never** uploaded to GitHub.

Instead, we maintain a `.env.example` file that contains the **variable names** but with **empty values**:

```env
# ─── LLM Keys (at least ONE is required — Groq is free) ───
GROQ_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# ─── Optional Data Sources ───
NEWS_API_KEY=
FRED_API_KEY=

# ─── Database (defaults to SQLite if not set) ───
# DATABASE_URL=sqlite:///./financial_ai.db

# ─── Redis (defaults to localhost if not set) ───
# REDIS_URL=redis://localhost:6379/0

# ─── Vector DB (defaults to local ChromaDB if not set) ───
Pinecone_Vector_Database=

# ─── LangSmith Tracing (optional, for debugging AI calls) ───
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=financial-research-agent
LANGCHAIN_API_KEY=
```

### The Workflow When a New API Key is Added
1. Your friend adds a new service (e.g., Stripe payments) to the code.
2. They add `STRIPE_SECRET_KEY=sk_live_abc123...` to their personal `.env` file (ignored by Git).
3. They also add `STRIPE_SECRET_KEY=` (empty) to `.env.example` (tracked by Git).
4. They push the code. You pull it.
5. You see the new line in `.env.example` and know you need to add `STRIPE_SECRET_KEY` to your own `.env`.
6. You privately message your friend to get the actual key value.

---

## 6. What Your Friend Needs To Do (Step-by-Step)

### Step 1: Install Git
1. Download Git from [https://gitforwindows.org/](https://gitforwindows.org/).
2. Install it using all the default settings (just keep clicking "Next").
3. Close and reopen your terminal (or restart VS Code / your editor) so the terminal recognizes the `git` command.
4. Verify it works: `git --version` (should show something like `git version 2.53.0.windows.2`).

### Step 2: Set Your Identity
Tell Git who you are (this tags your name on every change you make):
```bash
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```
*(Git will not print any success message. If it goes to a blank line, it worked.)*

### Step 3: Clone the Repository
Download the project from GitHub to your PC:
```bash
git clone https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git
```
This creates a folder called `Full-Stack-Client-Dashboard` on your computer with all the source code.

### Step 4: Set Up the Python Backend Environment
```bash
cd Full-Stack-Client-Dashboard

# Create a fresh virtual environment on YOUR machine
python -m venv .venv

# Activate it
.\.venv\Scripts\activate

# Install all Python dependencies from the recipe file
pip install -r requirements.txt
```

### Step 5: Set Up the Frontend
```bash
cd frontend

# Install all Node.js dependencies from the recipe file
npm install
```

### Step 6: Create Your Personal `.env` File
1. Look at the `.env.example` file in the project root. It shows all the API keys this project needs.
2. Create a new file called `.env` in the project root (same level as `.env.example`).
3. Copy the contents of `.env.example` into `.env`.
4. Fill in the actual secret values. Ask Tilak privately for the keys!

### Step 7: Verify Everything Works
Open two terminals:

**Terminal 1 (Backend):**
```bash
cd Full-Stack-Client-Dashboard
.\.venv\Scripts\activate
cd backend
uvicorn app.main:app --reload
```
You should see: `INFO: Uvicorn running on http://127.0.0.1:8000`

**Terminal 2 (Frontend):**
```bash
cd Full-Stack-Client-Dashboard\frontend
npm run dev
```
Open `http://localhost:3000` in your browser. You should see the dashboard!

---

## 7. The Branch Workflow — How We Write Code Without Breaking Each Other's Work

### The Golden Rule
> **NEVER write code directly on the `main` branch.**  
> Always create a new branch for every feature or bugfix.

### Visual Overview

```
main ──────────────●────────────────────●──────────────────●──── (always stable)
                   │                    ▲                  ▲
                   │                    │                  │
                   ├── tilak-login ─────┘  (merged via PR) │
                   │                                       │
                   └── friend-db-fix ──────────────────────┘  (merged via PR)
```

### The Complete Cycle (Step by Step)

#### Phase A: Start Your Work
```bash
# 1. Make sure you're on main
git checkout main

# 2. Download the latest code from GitHub (in case your partner merged something)
git pull origin main

# 3. Create a new branch for YOUR task
git checkout -b tilak-login-feature
```
Your friend does the same on their PC:
```bash
git checkout main
git pull origin main
git checkout -b friend-database-fix
```

Now you are BOTH working in isolated sandboxes. Nothing you do affects the other person.

#### Phase B: Write Code and Save It
Spend hours or days writing code. When you finish (or want to save progress):
```bash
# Stage all changed files
git add .

# Create a labeled save point
git commit -m "Added login page with form validation"
```

You can commit as many times as you want on your branch. Each commit is a checkpoint you can return to.

#### Phase C: Push Your Branch to GitHub
Your branch currently only exists on your physical PC. Upload it to GitHub:
```bash
git push origin tilak-login-feature
```
Your friend pushes their branch:
```bash
git push origin friend-database-fix
```

Now GitHub has **3 branches**: `main`, `tilak-login-feature`, and `friend-database-fix`.

#### Phase D: Create a Pull Request (Code Review)
This happens on the **GitHub website**, not in the terminal!

1. Go to `https://github.com/Tilak1452/Full-Stack-Client-Dashboard`.
2. GitHub will show a yellow banner: *"tilak-login-feature had recent pushes — Compare & pull request"*.
3. Click the green **Compare & pull request** button.
4. Write a short description of what you changed.
5. Click **Create pull request**.

Now your partner can:
- Open the Pull Request on GitHub.
- See exactly which files changed and which lines were added/removed (shown in green/red).
- Leave comments on specific lines if something looks wrong.
- Click the green **Merge pull request** button when everything looks good.

#### Phase E: Update Your Local PC After a Merge
After a Pull Request is merged on GitHub, your local PC is outdated. Sync it:
```bash
# Go back to main
git checkout main

# Download the newly merged code
git pull origin main
```

Now you're ready to create a new branch for your next task!

#### Phase F: What If We Both Edit the Same File? (Merge Conflicts)
If you edited line 15 of `main.py` AND your friend also edited line 15 of `main.py`, GitHub will flag a **merge conflict** and pause the merge.

GitHub will show both versions side by side:
```
<<<<<<< tilak-login-feature
print("Tilak's version of this line")
=======
print("Friend's version of this line")
>>>>>>> main
```

You simply pick which version to keep (or combine them), then complete the merge. GitHub makes this very visual and easy.

---

## 8. Common Git Commands Cheat Sheet

### Setup (One-Time)
| Command | What It Does |
|---------|-------------|
| `git config --global user.name "Name"` | Set your identity (name) |
| `git config --global user.email "email"` | Set your identity (email) |
| `git init` | Turn a folder into a Git repository |
| `git clone <url>` | Download a repository from GitHub |
| `git remote add origin <url>` | Link your local repo to a GitHub URL |

### Daily Workflow
| Command | What It Does |
|---------|-------------|
| `git status` | See which files you've changed |
| `git add .` | Stage all changes for commit |
| `git commit -m "message"` | Save a labeled checkpoint |
| `git push origin <branch-name>` | Upload your branch to GitHub |
| `git pull origin main` | Download latest `main` from GitHub |

### Branch Management
| Command | What It Does |
|---------|-------------|
| `git branch` | List all local branches (current one has a `*`) |
| `git checkout main` | Switch to the `main` branch |
| `git checkout -b new-branch` | Create AND switch to a new branch |
| `git branch -d branch-name` | Delete a local branch (after merging) |

### Checking History
| Command | What It Does |
|---------|-------------|
| `git log --oneline -10` | Show last 10 commits in one line each |
| `git diff` | Show what changed in your files (before staging) |

---

## 9. Common Errors & How To Fix Them

### Error: `git is not recognized`
**Cause:** Terminal was opened before Git was installed.  
**Fix:** Close and reopen your terminal (or restart VS Code / your editor entirely).

### Error: `failed to push — Updates were rejected`
**Cause:** GitHub has changes that your PC doesn't have yet.  
**Fix:** Pull first, then push:
```bash
git pull origin main
git push origin main
```
If this is the very first push and GitHub has a default README: `git push -u origin main --force`

### Error: `remote origin already exists`
**Cause:** You ran `git remote add origin` twice.  
**Fix:** Either ignore it (it's already set) or update it:
```bash
git remote set-url origin https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git
```

### Error: `merge conflict`
**Cause:** Two people edited the same line of the same file.  
**Fix:** Open the conflicted file, look for `<<<<<<<` markers, choose which version to keep, remove the markers, then:
```bash
git add .
git commit -m "Resolved merge conflict"
```

### Error: `ModuleNotFoundError` (after pulling new code)
**Cause:** Your teammate added a new Python dependency that you haven't installed yet.  
**Fix:** Re-run the install command:
```bash
pip install -r requirements.txt
```
For frontend dependencies:
```bash
cd frontend
npm install
```

---

## 10. FAQ

### Q: Do I need to pay for GitHub?
**A:** No! GitHub is free for public and private repositories with unlimited collaborators.

### Q: Can I use GitHub Desktop instead of the terminal?
**A:** Yes! [GitHub Desktop](https://desktop.github.com/) is a visual app that does the same things as the terminal commands. It's great for beginners. You can click buttons instead of typing commands.

### Q: What happens if I accidentally commit my `.env` file?
**A:** Immediately revoke all API keys listed in that file (regenerate them from the provider dashboards). Then remove the file from Git history:
```bash
git rm --cached .env
git commit -m "Remove .env from tracking"
git push
```

### Q: How often should I commit?
**A:** Commit frequently! Every time you finish a small, logical piece of work (e.g., "Added the search bar", "Fixed the API error"). Smaller commits make it easier to review and undo changes.

### Q: Do I need to create a new branch for every tiny change?
**A:** For small fixes (like fixing a typo), you can commit directly to `main`. But for anything that takes more than 15 minutes of work, always use a branch.

### Q: What if I forgot to pull before starting work?
**A:** No problem. Save your work on your branch, then:
```bash
git checkout main
git pull origin main
git checkout your-branch
git merge main
```
This brings the latest `main` code into your branch.

---

> **Remember:** The `.env` file with real API keys should NEVER be shared on GitHub or any public platform. Always share keys privately (e.g., via WhatsApp direct message).
