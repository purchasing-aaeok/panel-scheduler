# Panel Scheduler

A web-based panel build scheduling app for your team.

## Deploy to Railway (free, ~10 minutes)

### Step 1 — Install Git
Download from https://git-scm.com/downloads and install it.
Open a terminal (Command Prompt on Windows, Terminal on Mac) and verify:
```
git --version
```

### Step 2 — Install Node.js
Download from https://nodejs.org (choose the LTS version) and install it.
Verify:
```
node --version
```

### Step 3 — Create a Railway account
Go to https://railway.app and sign up with your GitHub account.
(You'll need a free GitHub account too — https://github.com if you don't have one)

### Step 4 — Push this project to GitHub
In your terminal, navigate to this folder and run:
```
git init
git add .
git commit -m "Initial commit"
```
Then go to https://github.com/new, create a new repository called `panel-scheduler`,
and follow the instructions to push your existing code.

### Step 5 — Deploy on Railway
1. Go to https://railway.app/new
2. Choose "Deploy from GitHub repo"
3. Select your `panel-scheduler` repository
4. Railway will auto-detect Node.js and deploy it
5. Click "Generate Domain" to get your public URL

That's it! Share the URL with your team.

## Running locally (for testing)

```
npm install
npm start
```
Then open http://localhost:3000 in your browser.

## How it works

- The app runs as a small Node.js server
- When you click **Save**, the schedule is sent to the server and written to `data/schedule.json`
- When anyone opens the app URL, it automatically loads the latest saved schedule
- All team members see the same data

## Updating the app

If you make changes, commit and push to GitHub — Railway redeploys automatically.
