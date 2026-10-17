import { Camera, Trash2 } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";

const OnboardingProfilePicturePicker = ({
  src,
  name,
  userId,
  hasSelectedFile = false,
  isValidating = false,
  isUploading = false,
  uploadProgress = 0,
  disabled = false,
  error = "",
  onSelect,
  onRemove,
}) => (
  <section
    className="flex flex-col items-center gap-4 rounded-2xl border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-center sm:justify-center sm:gap-5"
    aria-labelledby="onboarding-profile-picture-heading"
  >
    <UserAvatar
      src={src}
      name={name}
      userId={userId}
      alt="Profile picture preview"
      className="size-24 text-2xl ring ring-base-300 ring-offset-2 ring-offset-base-100 sm:size-28"
      loading="eager"
    />
    <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
      <div>
        <h2 id="onboarding-profile-picture-heading" className="font-semibold">
          Profile picture{" "}
          <span className="font-normal opacity-60">(optional)</span>
        </h2>
        <p className="mt-1 text-xs opacity-60">
          Choose a JPG, PNG, or WebP image up to 5 MB.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        <label className="btn btn-outline btn-sm min-h-11 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
          <Camera className="size-4" aria-hidden="true" />
          {hasSelectedFile || src ? "Change photo" : "Choose photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Choose a profile picture from your device"
            onChange={onSelect}
            disabled={disabled}
          />
        </label>
        {(hasSelectedFile || src) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-11 text-base-content/60"
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {hasSelectedFile ? "Remove selection" : "Remove photo"}
          </button>
        )}
      </div>
      {isValidating && (
        <p className="text-xs" role="status" aria-live="polite">
          Checking image…
        </p>
      )}
      {isUploading && (
        <div
          className="w-full min-w-48 space-y-1"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs">
            Uploading photo… {Math.round(uploadProgress)}%
          </p>
          <progress
            className="progress progress-primary h-1.5 w-full"
            value={uploadProgress}
            max="100"
            aria-label="Profile photo upload progress"
          />
        </div>
      )}
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  </section>
);

export default OnboardingProfilePicturePicker;
