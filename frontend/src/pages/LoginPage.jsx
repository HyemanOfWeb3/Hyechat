import React, { useState } from "react";
import { ShipWheelIcon } from "lucide-react";
import { Link } from "react-router";
import useLogin from "../hooks/useLogin.js";
import { useThemeStore } from "../store/useThemeStore.js";

const LoginPage = () => {
  const { theme } = useThemeStore();
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Without a custom hook
  // const queryClient = useQueryClient();

  // const {
  //   mutate: loginMutation,
  //   isPending,
  //   error,
  // } = useMutation({
  //   mutationFn: login,

  //   onSuccess: () => {
  //     toast.success("Login successful!");
  //     queryClient.invalidateQueries({ queryKey: ["authUser"] });
  //   },
  // });
  // Without a custom hook

  const { isPending, error, loginMutation } = useLogin();

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation(loginData);
  };

  return (
    <div
      className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8"
      data-theme={theme}
    >
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* LOGIN FORM SECTION */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          {/* LOGO */}
          <div className="mb-4 flex items-center justify-start gap-2">
            <ShipWheelIcon className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              HyeChat
            </span>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="alert alert-error mb-4">
              <span>
                {error?.response?.data?.message ||
                  error?.message ||
                  "Unable to sign in right now. Please try again."}
              </span>
            </div>
          )}

          {/* LOGIN FORM */}

          <div className="w-full">
            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div className="">
                  <h2 className="text-xl font-semibold">Welcome Back</h2>
                  <p className="text-sm opacity-70">Sign in to your account</p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="form-control w-full space-y-2">
                    <label className="label">
                      {" "}
                      <span className="label-text">Email</span>{" "}
                    </label>
                    <input
                      type="email"
                      placeholder="hello@hyechat.com"
                      className="input input-bordered w-full"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-control w-full space-y-2">
                    <label className="label">
                      {" "}
                      <span className="label-text">Password</span>{" "}
                    </label>
                    <input
                      type="password"
                      placeholder="......"
                      className="input input-bordered w-full"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="text-left mt-4">
                    <p className="text-sm">
                      Forgot password ?{" "}
                      <Link
                        className="text-primary hover:underline"
                        to="/forget-password"
                      >
                    Reset
                      </Link>
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>

                  <div className="text-center mt-4">
                    <p className="text-sm">
                      Don't have an account?{" "}
                      <Link
                        className="text-primary hover:underline"
                        to="/signup"
                      >
                        Create one
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* IMAGE SECTION */}

        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center ">
          <div className="max-w-md p-8">
            {/* illustration */}
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/video.png"
                alt="Illustration"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center space-y-3 mt-6">
              <h2 className="text-xl font-semibold">
                Connect with peeps worldwide
              </h2>
              <p className="opacity-70">
                Converse, make friends, and explore new cultures with HyeChat's
                global community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
