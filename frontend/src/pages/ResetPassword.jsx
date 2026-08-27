import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, ShipWheelIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resetPassword } from "../lib/api.js";
import { useThemeStore } from "../store/useThemeStore.js";

const ResetPassword = () => {
  const { theme } = useThemeStore();
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const {
    mutate: resetPasswordMutation,
    isPending,
    isSuccess,
    error,
    reset: resetMutation,
  } = useMutation({ mutationFn: resetPassword });

  useEffect(() => {
    if (!isSuccess) return undefined;

    const redirectTimer = setTimeout(() => navigate("/login"), 1800);
    return () => clearTimeout(redirectTimer);
  }, [isSuccess, navigate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError("");
    resetMutation();

    if (!token) {
      setValidationError("This reset link is invalid.");
      return;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    resetPasswordMutation({ token, password });
  };

  const displayedError =
    validationError ||
    error?.response?.data?.message ||
    (error ? "Unable to reset your password. Please try again." : "");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8"
      data-theme={theme}
    >
      <div className="border border-primary/25 w-full max-w-md bg-base-100 rounded-xl shadow-lg p-6 sm:p-8">
        <div className="mb-8 flex items-center gap-2">
          <ShipWheelIcon className="size-9 text-primary" />
          <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
            HyeChat
          </span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Create a new password</h1>
          <p className="text-sm opacity-70 mt-1">
            Choose a password you have not used before.
          </p>
        </div>

        {displayedError && (
          <div className="alert alert-error mb-4">
            <span>{displayedError}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="alert alert-success">
            <span>Password reset successful. Redirecting to sign in...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control w-full">
              <label className="label" htmlFor="new-password">
                <span className="label-text">New password</span>
              </label>
              <label className="input input-bordered flex items-center gap-2">
                <LockKeyhole className="size-4 opacity-70" />
                <input
                  id="new-password"
                  type="password"
                  placeholder="At least 6 characters"
                  className="grow"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setValidationError("");
                  }}
                  minLength={6}
                  required
                />
              </label>
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="confirm-password">
                <span className="label-text">Confirm password</span>
              </label>
              <label className="input input-bordered flex items-center gap-2">
                <LockKeyhole className="size-4 opacity-70" />
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat your password"
                  className="grow"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setValidationError("");
                  }}
                  minLength={6}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Resetting...
                </>
              ) : (
                "Reset password"
              )}
            </button>
          </form>
        )}

        <Link to="/login" className="btn btn-ghost btn-sm mt-6 gap-2">
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
