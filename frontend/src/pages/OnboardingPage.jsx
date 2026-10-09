import { useState } from "react";
import useAuthUser from "../hooks/useAuthUser.js";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { completeOnboarding } from "../lib/api.js";
import {
  MapPinIcon,
  ShipWheelIcon,
  Loader,
} from "lucide-react";
import { LANGUAGES } from "../constants/index.js";
import UserAvatar from "../components/UserAvatar.jsx";

const OnboardingPage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState({
    fullName: authUser?.fullName || "",
    bio: authUser?.bio || "",
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    interests: (authUser?.interests || []).join(", "),
    location: authUser?.location || "",
    profilePic: authUser?.profilePic || "",
  });

  const { mutate: onboardingMutation, isPending } = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      toast.success("Onboarding completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },

    onError: (error) => {
      toast.error(error.response.data.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    onboardingMutation(formState);
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-base-100 items-center justify-center flex p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="card bg-base-200 w-full max-w-3xl shadow-xl">
        <div className="card-body p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">
            Complete Your Profile
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PROFILE AVATAR CONTAINER*/}
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* AVATAR PREVIEW */}
              <UserAvatar
                src={formState.profilePic}
                name={formState.fullName}
                userId={authUser?._id}
                alt="Profile preview"
                className="size-32 text-3xl"
              />

              <p className="text-center text-xs text-base-content/60">
                Your initials make a reliable avatar until you add a photo.
              </p>
            </div>

            {/* FULL NAME */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Full Name</span>
              </label>
              <input
                type="text"
                name="fullName"
                placeholder="John Doe"
                className="input input-bordered w-full"
                value={formState.fullName}
                onChange={(e) =>
                  setFormState({ ...formState, fullName: e.target.value })
                }
              />
            </div>

            {/* BIO */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Bio</span>
              </label>
              <textarea
                name="bio"
                value={formState.bio}
                onChange={(e) =>
                  setFormState({ ...formState, bio: e.target.value })
                }
                className="textarea textarea-bordered h-24"
                placeholder="A short bio about yourself"
              />
            </div>

            {/* LANGUAGES */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* NATIVE LANGUAGE */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Native Language</span>
                </label>
                <select
                  name="nativeLanguage"
                  className="select select-bordered w-full"
                  value={formState.nativeLanguage}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      nativeLanguage: e.target.value,
                    })
                  }
                >
                  <option value="" disabled>
                    Select your native language
                  </option>

                  {LANGUAGES.map((lang) => (
                    <option key={`native-${lang}`} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* LEARNING LANGUAGE */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Learning Language</span>
                </label>
                <select
                  name="learningLanguage"
                  className="select select-bordered w-full"
                  value={formState.learningLanguage}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      learningLanguage: e.target.value,
                    })
                  }
                >
                  <option value="" disabled>
                    Select your learning language
                  </option>

                  {LANGUAGES.map((lang) => (
                    <option key={`learning-${lang}`} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* LOCATION */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Location</span>
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 size-5 text-base-content opacity-70" />
                <input
                  type="text"
                  name="location"
                  placeholder="City, Country"
                  className="input input-bordered w-full pl-10"
                  value={formState.location}
                  onChange={(e) =>
                    setFormState({ ...formState, location: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Interests (optional)</span>
              </label>
              <input
                type="text"
                name="interests"
                placeholder="Cooking, hiking, films"
                className="input input-bordered w-full"
                value={formState.interests}
                onChange={(e) =>
                  setFormState({ ...formState, interests: e.target.value })
                }
              />
              <span className="mt-1 text-xs opacity-60">
                Separate interests with commas to help find compatible language
                partners.
              </span>
            </div>

            {/* SUBMIT BUTTON */}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isPending}
            >
              {!isPending ? (
                <>
                  <ShipWheelIcon className="size-5 mr-2" />
                  Complete Onboarding
                </>
              ) : (
                <>
                  <Loader className="animate-spin size-5 mr-2" />
                  Completing Onboarding...
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
