import { useState, type FormEvent } from "react";
import { Coffee, LockKeyhole } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { api } from "../api/client";
import { errorMessage } from "./types";

type Session = {
  token: string;
  expiresAt: string;
  user: { id: number; username: string; role: string };
};
export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      login(
        await api<Session>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }),
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-icon">
            <Coffee size={20} />
          </span>
          <div>
            <b>LensOS</b>
            <span>Caffe Lens · upravljanje poslovanjem</span>
          </div>
        </div>
        <h1>Dobro došli</h1>
        <p>Prijavite se za pristup evidenciji kafića.</p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="form-stack">
          <label>
            Korisničko ime
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={120}
              required
            />
          </label>
          <label>
            Lozinka
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={200}
              required
            />
          </label>
          <button className="button primary full" disabled={busy}>
            <LockKeyhole size={16} />
            {busy ? "Prijavljivanje…" : "Prijavi se"}
          </button>
        </form>
        <small className="login-footnote">
          Pristup imaju samo ovlašteni korisnici.
        </small>
      </section>
    </main>
  );
}
