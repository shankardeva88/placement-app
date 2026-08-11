import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword } from "firebase/auth";
import { auth } from "../firebase/config";

/** Firebase's own hosted reset flow — sends an email with a link that lets
 * the user set a new password directly with Google, no custom backend or
 * token handling needed on our end. Works for every role (student, staff,
 * admin) since they're all just Firebase Auth accounts. */
export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

/** updatePassword() requires a "recently signed in" session — re-authenticating
 * with their current password first avoids the intermittent auth/requires-recent-login
 * error rather than surfacing it to the user as a confusing failure. */
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Not signed in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}
