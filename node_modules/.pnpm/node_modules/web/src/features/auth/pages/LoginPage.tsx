import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Loader2, LogIn } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { api } from "@/services/api";
import AuthLayout from "@/layouts/AuthLayout";
import { cn } from "@/lib/utils";

type LoginForm = {
  username: string;
  password: string;
};

function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      const response = await api.post("/auth/login", data);
      const { accessToken, user } = response.data;
      login(user, accessToken);

      if (user.role === "ADMIN") navigate("/admin");
      else if (user.role === "SUPERVISOR") navigate("/supervisor");
      else navigate("/agent");
    } catch (error) {
      console.error(error);
      setServerError("Invalid username or password.");
    }
  };

  const fieldClass = cn(
    "h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
    "placeholder:text-fg-subtle transition-colors",
    "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40"
  );

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="username"
            className="text-xs font-medium text-fg-muted"
          >
            Username
          </label>
          <input
            id="username"
            autoComplete="username"
            placeholder="you@company.com"
            className={fieldClass}
            {...register("username", { required: "Username is required" })}
          />
          {errors.username && (
            <p className="text-xs text-danger">{errors.username.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-xs font-medium text-fg-muted"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className={fieldClass}
            {...register("password", { required: "Password is required" })}
          />
          {errors.password && (
            <p className="text-xs text-danger">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md",
            "bg-accent text-sm font-medium text-accent-fg shadow-elev-1",
            "transition-opacity hover:opacity-90 disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-xs text-fg-subtle">
          Trouble signing in? Contact your workspace admin.
        </p>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
