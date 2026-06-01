import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  displayName: string;
  firebaseUid?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get the ID token for API requests
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          localStorage.setItem("firebaseToken", idToken);

          // Verify token with backend and get user info
          try {
            const response = await api.post("/api/auth/verify-token", {});
            const userData = response.data;
            setUser({
              id: userData.userId,
              email: userData.email,
              displayName: userData.displayName,
              firebaseUid: userData.firebaseUid,
            });
            localStorage.setItem("user", JSON.stringify(userData));
          } catch (error) {
            console.error("Failed to verify token with backend:", error);
            // Still set user from Firebase data
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName:
                firebaseUser.displayName ||
                firebaseUser.email?.split("@")[0] ||
                "User",
              firebaseUid: firebaseUser.uid,
            });
          }
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem("firebaseToken");
          localStorage.removeItem("user");
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Get ID token
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      localStorage.setItem("firebaseToken", idToken);

      // Verify with backend and get user info
      try {
        const response = await api.post("/api/auth/verify-token", {});
        setUser({
          id: response.data.userId,
          email: response.data.email,
          displayName: response.data.displayName,
          firebaseUid: response.data.firebaseUid,
        });
        localStorage.setItem("user", JSON.stringify(response.data));
      } catch (error) {
        console.error("Failed to verify with backend:", error);
        // Still set user from Firebase data
        setUser({
          id: result.user.uid,
          email: result.user.email || "",
          displayName:
            result.user.displayName ||
            result.user.email?.split("@")[0] ||
            "User",
          firebaseUid: result.user.uid,
        });
      }
    } catch (error: any) {
      console.error("Google login error:", error);
      throw new Error(error.message || "Failed to login with Google");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setToken(null);
      localStorage.removeItem("firebaseToken");
      localStorage.removeItem("user");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
