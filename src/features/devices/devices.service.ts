import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { firebaseAuth, firestore } from "../../lib/firebase";
import { normalizeFid, sortDevices, type QaDevice } from "./devices.model";

const COLLECTION = "qa_devices";

export function watchFirebaseUser(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth(), callback);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
}

export async function signOutFromFirebase(): Promise<void> {
  await signOut(firebaseAuth());
}

export function watchDevices(
  onChange: (devices: QaDevice[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(firestore(), COLLECTION),
    (snapshot) => {
      onChange(
        sortDevices(
          snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              fid: entry.id,
              label: typeof data.label === "string" ? data.label : entry.id,
              authorized: data.authorized === true,
              updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate().toISOString(),
            };
          }),
        ),
      );
    },
    onError,
  );
}

export async function saveDevice(device: { fid: string; label: string; authorized: boolean }): Promise<void> {
  await setDoc(
    doc(firestore(), COLLECTION, normalizeFid(device.fid)),
    { label: device.label.trim(), authorized: device.authorized, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function removeDevice(fid: string): Promise<void> {
  await deleteDoc(doc(firestore(), COLLECTION, fid));
}
