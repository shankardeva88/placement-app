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
        setStudent(null);
      } else {
        setAppUser(null);
        setStudent(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    return onValue(ref(db, `${DB_NODES.users}/${firebaseUser.uid}`), (snap) => {
      setAppUser(snap.exists() ? (snap.val() as AppUser) : null);
    });
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !appUser) return;

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
  }, [firebaseUser, appUser]);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, student, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
