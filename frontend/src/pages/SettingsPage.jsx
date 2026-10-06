import { createElement, useMemo } from "react";
import {
  Bell,
  Eye,
  LockKeyhole,
  Palette,
  Shield,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import ThemeSelector from "../components/ThemeSelector.jsx";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../lib/api.js";

const defaultPreferences = {
  messages: { inApp: true, email: false },
  friendRequests: { inApp: true, email: false },
  storyReactions: { inApp: true, email: false },
  storyReplies: { inApp: true, email: false },
  communityActivity: { inApp: true, email: false },
  calls: { inApp: true, email: false },
  marketplace: { inApp: true, email: false },
  mentions: { inApp: true, email: false },
  languagePartnerActivity: { inApp: true, email: false },
};

const notificationCategories = [
  { key: "messages", label: "Messages" },
  { key: "friendRequests", label: "Friend requests" },
  { key: "storyReactions", label: "Story reactions" },
  { key: "storyReplies", label: "Story replies" },
  { key: "communityActivity", label: "Community activity" },
  { key: "calls", label: "Calls" },
  { key: "marketplace", label: "Marketplace" },
  { key: "mentions", label: "Mentions" },
  { key: "languagePartnerActivity", label: "Language partner activity" },
];

const SettingsRow = ({ icon: Icon, title, description, children }) => (
  <div className="flex flex-col gap-4 border-b border-base-300 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {createElement(Icon, { className: "size-5" })}
      </div>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm opacity-60">{description}</p>
      </div>
    </div>
    <div className="shrink-0 sm:pl-6">{children}</div>
  </div>
);

const SettingsPage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const initialPreferences = useMemo(
    () => authUser?.notificationPreferences || defaultPreferences,
    [authUser],
  );

  const { data: notificationPreferences = initialPreferences } = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
    enabled: !!authUser,
    initialData: initialPreferences,
  });

  const preferenceMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(["notificationPreferences"], updatedPreferences);
      queryClient.setQueryData(["authUser"], (existing) => {
        if (!existing?.user) return existing;
        return {
          ...existing,
          user: {
            ...existing.user,
            notificationPreferences: updatedPreferences,
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification preferences saved");
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Unable to save notification preferences",
      ),
  });

  const handlePreferenceToggle = (category, channel) => {
    const current = notificationPreferences?.[category] || defaultPreferences[category];
    const nextPreferences = {
      ...notificationPreferences,
      [category]: {
        ...current,
        [channel]: !current?.[channel],
      },
    };

    preferenceMutation.mutate(nextPreferences);
  };

  return (
    <div className="w-full overflow-y-auto bg-base-100 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b border-base-300 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Preferences
          </p>
          <h1 className="mt-1 text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm opacity-60">
            Keep HyeChat comfortable, private, and yours.
          </p>
        </header>
        <section className="rounded-xl border border-base-300 bg-base-200 px-5 sm:px-7">
          <SettingsRow
            icon={Palette}
            title="Appearance"
            description="Choose the color theme used across HyeChat."
          >
            <ThemeSelector />
          </SettingsRow>
          <SettingsRow
            icon={UserRound}
            title="Profile and account"
            description="Update your public profile and account details."
          >
            <Link to="/profile" className="btn btn-outline btn-sm">
              Open profile
            </Link>
          </SettingsRow>
          <SettingsRow
            icon={LockKeyhole}
            title="Security"
            description="Password changes and account deletion live in Profile."
          >
            <Link to="/profile" className="btn btn-outline btn-sm">
              Manage security
            </Link>
          </SettingsRow>
          <SettingsRow
            icon={Eye}
            title="Privacy"
            description="Privacy controls will appear when the backend privacy model is enabled."
          >
            <span className="badge badge-ghost">Coming soon</span>
          </SettingsRow>
          <SettingsRow
            icon={Bell}
            title="Notifications"
            description="Choose which notification channels stay active."
          >
            <div className="flex w-full justify-end">
              <span className="badge badge-ghost">Server-backed</span>
            </div>
          </SettingsRow>
          <div className="space-y-3 py-4">
            {notificationCategories.map(({ key, label }) => {
              const current = notificationPreferences?.[key] || defaultPreferences[key];
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{label}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => handlePreferenceToggle(key, "inApp")}
                      className={`btn btn-sm ${current.inApp ? "btn-primary" : "btn-outline"}`}
                      aria-pressed={current.inApp}
                      disabled={preferenceMutation.isPending}
                    >
                      In-app {current.inApp ? "on" : "off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreferenceToggle(key, "email")}
                      className={`btn btn-sm ${current.email ? "btn-secondary" : "btn-outline"}`}
                      aria-pressed={current.email}
                      disabled={preferenceMutation.isPending}
                    >
                      Email {current.email ? "on" : "off"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {preferenceMutation.isPending && (
            <p className="pb-3 text-right text-sm opacity-60" role="status">
              Saving notification preferences…
            </p>
          )}
          <SettingsRow
            icon={Shield}
            title="Account protection"
            description="Authenticated actions are protected by your HyeChat session."
          >
            <span className="text-sm font-semibold text-success">Active</span>
          </SettingsRow>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
