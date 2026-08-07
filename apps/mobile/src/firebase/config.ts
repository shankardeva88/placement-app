// Firebase initialization — mobile app (Expo/React Native).
// Uses Realtime Database + Auth only — no billing account required.
// File "uploads" use pasted Google Drive links for now (see web config
// comment for details). Storage import re-enabled once billing is on.

import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
// import { getStorage } from "firebase/storage"; // re-enable once billing is on
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  databaseURL: Constants.expoConfig?.extra?.firebaseDatabaseUrl,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getDatabase(app);
// export const storage = getStorage(app); // re-enable once billing is on
