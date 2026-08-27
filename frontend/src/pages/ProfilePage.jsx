import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Camera,
  Check,
  KeyRound,
  Loader2,
  MapPin,
  Save,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  changeMyPassword,
  deleteMyAccount,
  updateMyProfile,
} from "../lib/api.js";
import { LANGUAGES } from "../constants/index.js";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const profileData = profile || {
    fullName: authUser.fullName || "",
    email: authUser.email || "",
    bio: authUser.bio || "",
    profilePic: authUser.profilePic || "",
    nativeLanguage: authUser.nativeLanguage || "",
    learningLanguage: authUser.learningLanguage || "",
    location: authUser.location || "",
  };

  const profileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["authUser"], { success: true, user });
      toast.success("Profile updated");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Unable to update profile")),
  });

  const passwordMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: ({ message }) => {
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success(message || "Password changed successfully");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Unable to change password")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: ({ message }) => {
      queryClient.clear();
      toast.success(message || "Account deleted");
      navigate("/login", { replace: true });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Unable to delete account")),
  });

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    if (!profileData.fullName.trim() || !profileData.email.trim()) {
      toast.error("Full name and email are required");
      return;
    }
    profileMutation.mutate(profileData);
  };

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    passwordMutation.mutate(passwords);
  };

  const handleDelete = (event) => {
    event.preventDefault();
    deleteMutation.mutate(deletePassword);
  };

  if (!authUser) {
    return (
      <div className="flex w-full justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="w-full overflow-y-auto bg-base-100 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="border-b border-base-300 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Account
          </p>
          <h1 className="mt-1 text-3xl font-bold text-base-content">
            Profile settings
          </h1>
          <p className="mt-2 text-sm text-base-content/60">
            Manage your HyeChat identity and account security.
          </p>
        </header>

        <section className="card border border-base-300 bg-base-200 shadow-sm">
          <div className="card-body gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="avatar">
                <div className="w-24 rounded-full bg-base-300 ring ring-primary ring-offset-2 ring-offset-base-200">
                  {profileData.profilePic ? (
                    <img src={profileData.profilePic} alt="Profile preview" />
                  ) : (
                    <UserRound className="m-auto mt-7 size-10 opacity-40" />
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {profileData.fullName || "Your profile"}
                </h2>
                <p className="text-sm text-base-content/60">
                  {profileData.email}
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                  <span className="size-2 rounded-full bg-success" /> Account
                  active
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="divider my-0 justify-start text-sm font-bold">
                Personal information
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-2 font-semibold">
                    Full name
                  </span>
                  <input
                    className="input input-bordered w-full"
                    value={profileData.fullName}
                    onChange={(event) =>
                      setProfile({
                        ...profileData,
                        fullName: event.target.value,
                      })
                    }
                    maxLength={100}
                    required
                  />
                </label>
                <label className="form-control">
                  <span className="label-text mb-2 font-semibold">Email</span>
                  <input
                    type="email"
                    className="input input-bordered w-full"
                    value={profileData.email}
                    onChange={(event) =>
                      setProfile({ ...profileData, email: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="form-control md:col-span-2">
                  <span className="label-text mb-2 font-semibold">Bio</span>
                  <textarea
                    className="textarea textarea-bordered min-h-24"
                    value={profileData.bio}
                    onChange={(event) =>
                      setProfile({ ...profileData, bio: event.target.value })
                    }
                    maxLength={500}
                    placeholder="Tell language partners a little about yourself"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text mb-2 font-semibold">
                    Native language
                  </span>
                  <select
                    className="select select-bordered w-full"
                    value={profileData.nativeLanguage}
                    onChange={(event) =>
                      setProfile({
                        ...profileData,
                        nativeLanguage: event.target.value,
                      })
                    }
                  >
                    <option value="">Select a language</option>
                    {LANGUAGES.map((language) => (
                      <option
                        key={`native-${language}`}
                        value={language.toLowerCase()}
                      >
                        {language}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text mb-2 font-semibold">
                    Learning language
                  </span>
                  <select
                    className="select select-bordered w-full"
                    value={profileData.learningLanguage}
                    onChange={(event) =>
                      setProfile({
                        ...profileData,
                        learningLanguage: event.target.value,
                      })
                    }
                  >
                    <option value="">Select a language</option>
                    {LANGUAGES.map((language) => (
                      <option
                        key={`learning-${language}`}
                        value={language.toLowerCase()}
                      >
                        {language}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text mb-2 flex items-center gap-2 font-semibold">
                    <MapPin className="size-4" /> Location
                  </span>
                  <input
                    className="input input-bordered w-full"
                    value={profileData.location}
                    onChange={(event) =>
                      setProfile({
                        ...profileData,
                        location: event.target.value,
                      })
                    }
                    maxLength={120}
                    placeholder="City, country"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text mb-2 flex items-center gap-2 font-semibold">
                    <Camera className="size-4" /> Profile picture URL
                  </span>
                  <input
                    type="url"
                    className="input input-bordered w-full"
                    value={profileData.profilePic}
                    onChange={(event) =>
                      setProfile({
                        ...profileData,
                        profilePic: event.target.value,
                      })
                    }
                    placeholder="https://..."
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setProfile({
                      ...profileData,
                      profilePic: `https://avatarapi.runflare.run/public/${Math.floor(Math.random() * 100) + 1}.png`,
                    })
                  }
                >
                  <Camera className="size-4" /> Generate avatar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={profileMutation.isPending}
                >
                  <>
                    {profileMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}{" "}
                    {profileMutation.isPending ? "Saving..." : "Save changes"}
                  </>
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="card border border-base-300 bg-base-200 shadow-sm">
          <div className="card-body p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-1 size-5 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Change password</h2>
                <p className="text-sm text-base-content/60">
                  Use your current password to set a new one.
                </p>
              </div>
            </div>
            <form
              onSubmit={handlePasswordSubmit}
              className="mt-5 grid gap-4 md:grid-cols-3"
            >
              {[
                ["currentPassword", "Current password"],
                ["newPassword", "New password"],
                ["confirmPassword", "Confirm new password"],
              ].map(([name, label]) => (
                <label className="form-control" key={name}>
                  <span className="label-text mb-2 font-semibold">{label}</span>
                  <input
                    type="password"
                    className="input input-bordered w-full"
                    value={passwords[name]}
                    onChange={(event) =>
                      setPasswords({ ...passwords, [name]: event.target.value })
                    }
                    minLength={name === "currentPassword" ? 1 : 6}
                    required
                  />
                </label>
              ))}
              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}{" "}
                  {passwordMutation.isPending
                    ? "Updating..."
                    : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="card border border-error/40 bg-error/5 shadow-sm">
          <div className="card-body p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 size-5 text-error" />
              <div>
                <h2 className="text-xl font-bold text-error">Danger zone</h2>
                <p className="mt-1 text-sm text-base-content/70">
                  Deleting your account removes your stories, notifications, and
                  friend requests permanently.
                </p>
              </div>
            </div>
            {!showDeleteConfirm ? (
              <button
                type="button"
                className="btn btn-outline btn-error mt-5 w-fit"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete account
              </button>
            ) : (
              <form
                onSubmit={handleDelete}
                className="mt-5 space-y-4 rounded-lg border border-error/30 bg-base-100 p-4"
              >
                <p className="font-semibold">
                  Are you sure you want to permanently delete your account? This
                  action cannot be undone.
                </p>
                <label className="form-control max-w-md">
                  <span className="label-text mb-2 font-semibold">
                    Enter your current password
                  </span>
                  <input
                    type="password"
                    className="input input-bordered w-full"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    required
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-error text-white"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShieldAlert className="size-4" />
                    )}{" "}
                    Permanently delete
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
