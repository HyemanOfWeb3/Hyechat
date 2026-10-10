import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { MailCheck, RefreshCw, ShipWheelIcon } from "lucide-react";
import {
  resendVerificationOTP,
  sendVerificationOTP,
  verifyEmailOTP,
} from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import { useThemeStore } from "../store/useThemeStore.js";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

const VerifyEmailPage = () => {
  const { authUser, isLoading: isAuthLoading } = useAuthUser();
  const { theme } = useThemeStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputsRef = useRef([]);
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [status, setStatus] = useState("");

  const clearVerificationCode = (shouldFocus = true) => {
    setCode(Array(CODE_LENGTH).fill(""));
    if (shouldFocus) {
      window.setTimeout(() => inputsRef.current[0]?.focus(), 0);
    }
  };

  const verifyMutation = useMutation({
    mutationFn: verifyEmailOTP,
    onSuccess: (data) => {
      setStatus("verified");
      queryClient.setQueryData(["authUser"], {
        success: true,
        user: data.user,
      });
      setTimeout(
        () => navigate(data.user.isOnboarded ? "/" : "/onboarding"),
        700,
      );
    },
    onError: (error) => {
      const nextStatus =
        error.response?.status === 400 &&
          error.response?.data?.message?.includes("expired")
          ? "expired"
          : "invalid";
      setStatus(nextStatus);
      clearVerificationCode();
    },
  });

  const sendMutation = useMutation({
    mutationFn: sendVerificationOTP,
    onError: (error) => {
      if (error.response?.status === 429) {
        setSecondsLeft(RESEND_COOLDOWN_SECONDS);
        setStatus("cooldown");
      } else {
        setStatus("server-error");
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerificationOTP,
    onSuccess: () => {
      clearVerificationCode(true);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setStatus("sent");
    },
    onError: (error) => {
      if (error.response?.status === 429)
        setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setStatus("server-error");
      clearVerificationCode();
    },
  });

  useEffect(() => {
    if (!authUser || authUser.emailVerified) return;
    sendMutation.mutate();
    // The signup request already sends a code; this also recovers users whose first delivery failed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  useEffect(() => {
    if (!secondsLeft) return undefined;
    const timer = setInterval(
      () => setSecondsLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const updateCode = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextCode = [...code];
    nextCode[index] = digit;
    setCode(nextCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    const joined = nextCode.join("");
    if (joined.length === CODE_LENGTH) {
      verifyMutation.mutate(joined);
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);
    if (!pasted) return;

    const nextCode = Array.from(
      { length: CODE_LENGTH },
      (_, index) => pasted[index] || "",
    );
    setCode(nextCode);

    const lastFilledIndex = Math.min(pasted.length - 1, CODE_LENGTH - 1);
    inputsRef.current[lastFilledIndex]?.focus();

    if (pasted.length === CODE_LENGTH) {
      verifyMutation.mutate(pasted);
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0)
      inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1)
      inputsRef.current[index + 1]?.focus();
  };

  if (isAuthLoading) return null;
  if (!authUser) return <Navigate to="/login" replace />;
  if (authUser.emailVerified)
    return <Navigate to={authUser.isOnboarded ? "/" : "/onboarding"} replace />;

  const isBusy =
    verifyMutation.isPending ||
    resendMutation.isPending ||
    sendMutation.isPending;
  const message =
    status === "verified"
      ? "Email verified. Taking you to onboarding..."
      : status === "expired"
        ? "That code has expired. Request a new one."
        : status === "invalid"
          ? verifyMutation.error?.response?.data?.message ||
            "That code is not valid. Try again."
          : status === "sent"
            ? "A new verification code has been sent."
            : status === "cooldown"
              ? "A verification code was sent. You can request another code when the countdown ends."
              : status === "server-error"
                ? "We could not complete that request. Please try again."
                : "Enter the six-digit code we sent to your inbox.";

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      data-theme={theme}
    >
      <section className="card w-full max-w-md bg-base-100 border border-primary/20 shadow-xl">
        <div className="card-body p-6 sm:p-8">
          <div className="flex items-center gap-2 text-primary mb-8">
            <ShipWheelIcon className="size-9" aria-hidden="true" />
            <span className="text-3xl font-bold font-mono">HyeChat</span>
          </div>
          <div className="mb-6">
            <MailCheck
              className="size-10 text-primary mb-3"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p className="text-sm opacity-70 mt-2">
              We sent a six-digit code to <strong>{authUser.email}</strong>.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              verifyMutation.mutate(code.join(""));
            }}
          >
            <fieldset disabled={isBusy || status === "verified"}>
              <legend className="sr-only">Email verification code</legend>
              <div
                className="flex justify-between gap-2 mb-5"
                onPaste={handlePaste}
              >
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputsRef.current[index] = element;
                    }}
                    value={digit}
                    onChange={(event) => updateCode(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    aria-label={`Verification digit ${index + 1} of ${CODE_LENGTH}`}
                    className="input input-bordered w-11 h-14 sm:w-12 text-center text-2xl font-bold"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              <button
                className="btn btn-primary w-full"
                type="submit"
                disabled={code.join("").length !== CODE_LENGTH}
              >
                {verifyMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />{" "}
                    Verifying...
                  </>
                ) : (
                  "Verify email"
                )}
              </button>
            </fieldset>
          </form>

          <p
            role="status"
            className={`text-sm mt-4 ${status === "verified" ? "text-success" : "text-error"}`}
          >
            {message}
          </p>
          <button
            type="button"
            className="btn btn-ghost mt-2"
            disabled={isBusy || secondsLeft > 0}
            onClick={() => resendMutation.mutate()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {resendMutation.isPending
              ? "Sending..."
              : secondsLeft > 0
                ? `Resend code in ${secondsLeft}s`
                : "Resend code"}
          </button>
        </div>
      </section>
    </main>
  );
};

export default VerifyEmailPage;
