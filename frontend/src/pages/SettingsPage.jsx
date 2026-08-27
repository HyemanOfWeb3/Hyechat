import { createElement } from "react";
import {
  Bell,
  Eye,
  LockKeyhole,
  Palette,
  Shield,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import ThemeSelector from "../components/ThemeSelector.jsx";

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

const SettingsPage = () => (
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
          description="Friend and story notifications use the current HyeChat defaults."
        >
          <span className="badge badge-ghost">Managed automatically</span>
        </SettingsRow>
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

export default SettingsPage;
