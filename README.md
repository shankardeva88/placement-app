# Placement App — Setup Guide (Start to Finish)

**Using Firebase Realtime Database + Auth only — no billing account
required.** Two things are deferred until you're ready to enable billing
later: **Cloud Functions** and **Firebase Storage** (file uploads). Both
now require the Blaze plan, so for now:
- Server-side logic (PRI calc, auto-notifications) runs client-side instead
- File uploads (resumes, offer letters, joining proof) use **pasted Google
  Drive share links** instead of in-app upload

Neither is a dead end — both are small, isolated changes to switch back on
later, without touching the rest of the app.

---

## 1. Create your Firebase project (browser)

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it (e.g. `college-placement-app`) → skip Google Analytics if you like
3. Wait for it to finish creating

## 2. Enable the services this app needs (browser)

- **Build > Authentication** → **Get started** → enable **Email/Password**
- **Build > Realtime Database** → **Create Database** → pick a region (e.g. `asia-southeast1`) → **Start in locked mode**

**Skip Functions and Storage entirely for now** — both need Blaze.

## 3. Register a Web app (browser)

1. On the project dashboard, click the **`</>`** icon to add a web app
2. Name it (e.g. `placement-web`)
3. Copy the `firebaseConfig` values shown: `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`
4. Also grab your **databaseURL** — go to **Realtime Database > Data** tab, copy the URL shown at the top

---

## 4. Install prerequisites (terminal)

```bash
node -v          # need v20+, get from nodejs.org if missing
npm install -g firebase-tools
firebase login   # opens browser to authenticate
```

## 5. Connect this folder to your Firebase project (terminal)

```bash
firebase use --add
```
Pick your project. Creates `.firebaserc`.

## 6. Set up environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```
Fill in `apps/web/.env.local` with the values from Step 3.

## 7. Install dependencies

```bash
npm install
```

## 8. Deploy the security rules

```bash
firebase deploy --only database
```
No billing prompt — Realtime Database is free on the Spark plan.

---

## Folder structure reference

```
placement-app/
├── firebase.json          # ties database rules + hosting together
├── database.rules.json    # role-based access rules (Realtime Database)
├── packages/
│   └── types/               # shared TypeScript types — single source of truth
│       └── src/index.ts
├── apps/
│   ├── web/                  # React + TS admin/coordinator/student web portal
│   │   └── src/firebase/config.ts
│   └── mobile/                # React Native + Expo student app
│       └── src/firebase/config.ts
└── functions/                # deferred — see functions/README.md
```

## How "file uploads" work for now

Any field that would normally be a Firebase Storage upload (resume, offer
letter, joining proof, JD) is just a **text field for a Google Drive link**
in the UI. Flow: student uploads their file to their own Google Drive,
sets sharing to "Anyone with the link can view", pastes the link into the
app. Not as smooth as native upload, but zero cost and zero billing setup.

## Important trade-off to know about (Realtime Database vs Firestore)

Realtime Database is one big JSON tree, not a set of queryable collections.
- No compound queries (e.g. "CSE students with CGPA > 7.5" needs fetching +
  filtering in-app, or a denormalized index node)
- Rules are more repetitive than Firestore's
- Fine at your scale — we'll flag it again if a specific screen needs it

## Next step

Once `firebase deploy --only database` succeeds, tell me and we'll build
the first real screen: **Student login + profile creation**.
