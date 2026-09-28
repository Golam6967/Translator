import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userId = params.get("userId");
    const error = params.get("error");

    if (error) {
      console.error("Authentication error:", error);
      navigate("/login");
      return;
    }

    if (token && userId) {
      // Store token and userId
      localStorage.setItem("authToken", token);

      // You can fetch user details from the backend here if needed
      // For now, just store the userId
      localStorage.setItem("userId", userId);

      // Redirect to dashboard
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">
          Completing authentication...
        </h1>
        <p className="text-text/60">
          Please wait while we set up your account.
        </p>
      </div>
    </div>
  );
}
