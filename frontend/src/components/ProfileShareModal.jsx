import { useState } from "react";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  Check,
  Copy,
  Globe,
  Share2,
  ShipWheel,
  X,
} from "lucide-react";
import SocialIcon from "./SocialIcon.jsx";

const copyToClipboard = async (value) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard unavailable");
};

export const ProfileShareModal = ({ profile, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !profile) return null;

  const origin = window.location.origin;
  const canonicalUrl = `${origin}/profile/${encodeURIComponent(profile._id)}`;

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(canonicalUrl);
      setCopied(true);
      toast.success("Profile link copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Unable to copy profile link");
    }
  };

  const handleNativeShare = async () => {
    const summary = profile.bio?.trim()
      ? profile.bio.trim().slice(0, 120)
      : "Connect and learn languages with me on HyeChat.";

    const shareData = {
      title: `${profile.fullName} on HyeChat`,
      text: `${profile.fullName} on HyeChat\n${summary}\n\nView my profile:`,
      url: canonicalUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await handleCopyLink();
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        await handleCopyLink();
      }
    }
  };

  const activeSocials = Object.entries(profile.socialLinks || {}).filter(
    ([, url]) => Boolean(url && typeof url === "string" && url.trim()),
  );

  const speaks = profile.nativeLanguage
    ? profile.nativeLanguage.charAt(0).toUpperCase() + profile.nativeLanguage.slice(1)
    : null;
  const learning = profile.learningLanguage
    ? profile.learningLanguage.charAt(0).toUpperCase() + profile.learningLanguage.slice(1)
    : null;

  return (
    <div
      className="modal modal-open modal-bottom sm:modal-middle z-50 bg-black/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-box relative max-h-[92dvh] overflow-y-auto p-4 sm:max-w-md sm:p-6 bg-base-100 border border-base-300 shadow-2xl rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-base-300">
          <div>
            <h3 id="share-modal-title" className="text-lg font-bold text-base-content">
              Share profile
            </h3>
            <p className="text-xs text-base-content/60">
              Share your HyeChat identity card
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={onClose}
            aria-label="Close share dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Visual Share Card */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-base-200 via-base-200 to-base-300 p-5 shadow-inner">
          {/* Card Top Branding */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-content shadow-xs">
                <ShipWheel className="size-4" />
              </div>
              <span className="font-mono text-base font-extrabold tracking-wider bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                HyeChat
              </span>
            </div>
            <span className="badge badge-primary badge-outline text-[11px] font-semibold tracking-wide uppercase">
              Profile Card
            </span>
          </div>

          {/* Profile Identity */}
          <div className="mt-4 flex flex-col items-center text-center">
            <div className="avatar ring-4 ring-primary/20 ring-offset-2 ring-offset-base-200 rounded-full shadow-md">
              <div className="size-20 overflow-hidden rounded-full bg-base-300 sm:size-24">
                {profile.profilePic ? (
                  <img
                    src={profile.profilePic}
                    alt={`${profile.fullName}'s avatar`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-3xl font-bold opacity-60">
                    {profile.fullName?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
            </div>

            <h4 className="mt-3 break-words text-xl font-bold text-base-content">
              {profile.fullName}
            </h4>

            {profile.emailVerified && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-info">
                <BadgeCheck className="size-3.5" /> Email verified
              </span>
            )}

            {profile.bio?.trim() && (
              <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-base-content/80 sm:text-sm">
                &ldquo;{profile.bio.trim()}&rdquo;
              </p>
            )}

            {/* Languages */}
            {(speaks || learning) && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-base-100/80 px-2.5 py-1 font-medium border border-base-300">
                  <Globe className="size-3 text-primary" />
                  {speaks && <span>Speaks {speaks}</span>}
                  {speaks && learning && <span className="opacity-40">•</span>}
                  {learning && <span>Learning {learning}</span>}
                </span>
              </div>
            )}

            {/* Socials on Card */}
            {activeSocials.length > 0 && (
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                {activeSocials.map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-circle btn-xs btn-ghost bg-base-100 border border-base-300 hover:border-primary"
                    aria-label={`Open ${profile.fullName}'s ${platform} profile`}
                    title={`${platform.toUpperCase()}: ${url}`}
                  >
                    <SocialIcon platform={platform} className="size-3.5" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Card Footer URL pill */}
          <div className="mt-4 pt-3 border-t border-base-300/70 text-center">
            <span className="text-[11px] font-mono text-base-content/50 break-all">
              hyechat.vercel.app/profile/{profile._id?.slice(-8)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-2.5">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1 min-h-11 gap-2 font-semibold"
              onClick={handleNativeShare}
            >
              <Share2 className="size-4" /> Share card
            </button>
            <button
              type="button"
              className={`btn ${copied ? "btn-success text-success-content" : "btn-outline"} min-h-11 px-4 gap-2 font-semibold`}
              onClick={handleCopyLink}
              title="Copy profile URL"
            >
              {copied ? (
                <>
                  <Check className="size-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy link
                </>
              )}
            </button>
          </div>

          <div className="rounded-xl bg-base-200/80 p-2.5 text-xs text-base-content/60 flex items-center justify-between gap-2 overflow-hidden">
            <span className="truncate font-mono">{canonicalUrl}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="btn btn-ghost btn-xs text-primary font-bold shrink-0"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileShareModal;
