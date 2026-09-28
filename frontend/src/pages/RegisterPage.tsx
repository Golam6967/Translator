import { Navigate } from "react-router-dom";

// Sign-in is Google-only (see AuthContext), so there is no separate registration form.
export default function RegisterPage() {
  return <Navigate to="/login" replace />;
}
