import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">
            AI Agency School
          </h1>
          <p className="text-muted-foreground mt-2">CRM - מערכת ניהול לקוחות</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">מייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="your@email.com"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              dir="ltr"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}
