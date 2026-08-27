import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, ShipWheelIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../lib/api.js";
import { useThemeStore } from "../store/useThemeStore.js";

const ForgetPassword = () => {
  const { theme } = useThemeStore();
  const [email, setEmail] = useState("");
  const {
    mutate: forgotPasswordMutation,
    isPending,
    isSuccess,
    error,
  } = useMutation({ mutationFn: forgotPassword });

  const handleSubmit = (event) => {
    event.preventDefault();
    forgotPasswordMutation(email.trim());
  };

  return (
    <div
      className="min-h-[100dvh] overflow-y-auto flex items-center justify-center p-4 sm:p-6 md:p-8"
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
          <h1 className="text-2xl font-semibold">Forgot your password?</h1>
          <p className="text-sm opacity-70 mt-1">
            Enter your email and we will send you a reset link.
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>
              {error.response?.data?.message ||
                "Unable to send the reset link right now. Please try again."}
            </span>
          </div>
        )}

        {isSuccess ? (
          <div className="alert alert-success">
            <span>{forgotPasswordMessage}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control w-full">
              <label className="label" htmlFor="forgot-password-email">
                <span className="label-text">Email</span>
              </label>
              <label className="input input-bordered flex items-center gap-2">
                <Mail className="size-4 opacity-70" />
                <input
                  id="forgot-password-email"
                  type="email"
                  placeholder="hello@hyechat.com"
                  className="grow"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                  Sending...
                </>
              ) : (
                "Send reset link"
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

const forgotPasswordMessage =
  "If an account with that email exists, a password reset link has been sent.";

export default ForgetPassword;
