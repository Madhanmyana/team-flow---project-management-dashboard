import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { api } from "../api";
import Logo from "./Logo";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Listen for Supabase OAuth redirect (Google sign-in)
  useEffect(() => {
    const handleSession = async (session) => {
      if (!session) return;
      try {
        const user = session.user;
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0],
            avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
          }),
        });
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem("token", data.access_token);
          localStorage.setItem("userEmail", session.user.email);
          onLogin();
        }
      } catch (err) {
        console.error("Google auth error:", err);
        setError("Google sign-in failed. Please try again.");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !localStorage.getItem("token")) {
        handleSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        if (!localStorage.getItem("token")) {
          handleSession(session);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [onLogin]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let data;
      if (mode === "signup") {
        if (!fullName.trim()) {
          throw new Error("Full name is required");
        }
        data = await api.signup(fullName.trim(), email.trim(), password);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("userEmail", email.trim());
        onLogin();
      } else {
        data = await api.signin(email.trim(), password);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("userEmail", email.trim());
        onLogin();
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-in">
        <div className="auth-logo">
          <Logo size={40} />
          <span className="auth-logo-text">TeamFlow</span>
        </div>

        <h2 className="auth-title">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="auth-subtitle">
          {mode === "signin"
            ? "Sign in to continue to your dashboard."
            : "Get started with TeamFlow for free."}
        </p>

        {/* Sign In / Sign Up Toggle */}
        <div className="auth-toggle">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => switchMode("signin")}
            type="button"
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => switchMode("signup")}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                type="text"
                className="input-field"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="input-field"
              placeholder={mode === "signup" ? "Min. 8 chars, A-Z, a-z, 0-9" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "signin"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          className="auth-google-btn"
          disabled={loading}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="auth-footer">
          {mode === "signin" ? (
            <>Don't have an account?{" "}
              <button type="button" className="auth-link" onClick={() => switchMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button type="button" className="auth-link" onClick={() => switchMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
