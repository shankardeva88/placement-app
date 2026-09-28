import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Student } from "@placement-app/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  student: Student | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  student: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  // appUser alone can't tell "the /users read hasn't resolved yet" (normal
  // on every fresh page load — briefly null before the first onValue
  // callback fires) apart from "it resolved and there's genuinely no
  // profile" (the deleted-account case below) — both look like appUser ===
  // null. This tracks which one it actually is.
  const [appUserChecked, setAppUserChecked] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // A new sign-in: appUser/student for this uid haven't been fetched
        // yet, so force back into the loading state rather than letting
        // RootRedirect decide using the previous (logged-out) student=null.
        setLoading(true);
        setAppUser(null);
        setAppUserChecked(false);
        setStudent(null);
      } else {
        setAppUser(null);
        setAppUserChecked(false);
        setStudent(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    setAppUserChecked(false);
    return onValue(ref(db, `${DB_NODES.users}/${firebaseUser.uid}`), (snap) => {
      setAppUser(snap.exists() ? (snap.val() as AppUser) : null);
      setAppUserChecked(true);
    });
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    // Still waiting on the /users read above (or it just got reset for a
    // new uid) — not the same as "resolved to nothing", so don't touch
    // loading yet.
    if (!appUserChecked) return;
    // No /users profile for this login — e.g. the account was deleted from
    // the database (removeStudent only removes the RTDB profile, not the
    // underlying Firebase Auth account, which needs Admin SDK access this
    // app doesn't have) while the old login credentials still work. Without
    // this, loading stayed stuck true forever: this effect used to bail out
    // silently whenever appUser was null, which meant RootRedirect/
    // ProtectedRoute's own "no appUser → back to /login" handling never got
    // a chance to run, since they gate on loading first.
    if (!appUser) {
      setStudent(null);
      setLoading(false);
      return;
    }

    // Only student accounts have a /students record — staff/recruiter
    // accounts don't. Reading a path that doesn't exist, where the rules
    // have no way to prove you'd own it if it did, is denied outright (same
    // reasoning as the applications/offers "read before it exists" fix) —
    // subscribing to it unconditionally for every role left `loading` stuck
    // true forever for any non-student login, since the denied read's error
    // callback fires instead of the success one and this never resolves.
    if (appUser.role !== "student") {
      setStudent(null);
      setLoading(false);
      return;
    }

    return onValue(ref(db, `${DB_NODES.students}/${firebaseUser.uid}`), (snap) => {
      setStudent(snap.exists() ? (snap.val() as Student) : null);
      setLoading(false);
    });
  }, [firebaseUser, appUser, appUserChecked]);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, student, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
