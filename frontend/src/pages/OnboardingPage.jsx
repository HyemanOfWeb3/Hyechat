import { useEffect, useRef, useState } from "react";
import useAuthUser from "../hooks/useAuthUser.js";
import useStreamClient from "../hooks/useStreamClient.js";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { completeOnboarding } from "../lib/api.js";
import { MapPinIcon, ShipWheelIcon, Loader } from "lucide-react";
import { LANGUAGES } from "../constants/index.js";
import OnboardingProfilePicturePicker from "../components/OnboardingProfilePicturePicker.jsx";
import {
  inspectProfilePictureFile,
  validateProfilePictureFile,
} from "../lib/profilePicture.js";
import {
  buildOnboardingPayload,
  uploadOnboardingProfilePicture,
} from "../lib/onboarding.js";

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Unable to complete onboarding";

const OnboardingPage = () => {
  const { authUser } = useAuthUser();
  const { client: streamClient } = useStreamClient();
  const queryClient = useQueryClient();
  const [selectedProfileImage, setSelectedProfileImage] = useState(null);
  const [uploadedProfilePic, setUploadedProfilePic] = useState("");
  const [profilePicRemoved, setProfilePicRemoved] = useState(false);
  const [profilePictureError, setProfilePictureError] = useState("");
  const [isValidatingPicture, setIsValidatingPicture] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const selectionGenerationRef = useRef(0);
  const previewUrlRef = useRef("");
  const removalBeforeSelectionRef = useRef(false);
  const submitInFlightRef = useRef(false);

  const [formState, setFormState] = useState({
    fullName: authUser?.fullName || "",
    bio: authUser?.bio || "",
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    interests: (authUser?.interests || []).join(", "),
    location: authUser?.location || "",
  });

  useEffect(
    () => () => {
      selectionGenerationRef.current += 1;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
    },
    [],
  );

  const { mutateAsync: completeOnboardingAsync, isPending } = useMutation({
    mutationFn: async ({
      values,
      imageFile,
      existingUpload,
      removePicture,
    }) => {
      let profilePic;
      if (imageFile) {
        profilePic = existingUpload;
        if (!profilePic) {
          setIsUploadingPicture(true);
          setUploadProgress(0);
          try {
            profilePic = await uploadOnboardingProfilePicture({
              file: imageFile,
              streamClient,
              userId: authUser?._id,
              onProgress: setUploadProgress,
            });
            setUploadedProfilePic(profilePic);
            setUploadProgress(100);
          } catch (error) {
            error.phase = "profile-picture-upload";
            throw error;
          } finally {
            setIsUploadingPicture(false);
          }
        }
      } else if (removePicture) {
        profilePic = "";
      }

      return completeOnboarding(
        buildOnboardingPayload(values, { profilePic, removePicture }),
      );
    },
    onSuccess: () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      setSelectedProfileImage(null);
      setUploadedProfilePic("");
      toast.success("Onboarding completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      if (error?.phase === "profile-picture-upload") {
        setProfilePictureError(message);
      }
      toast.error(message);
    },
  });

  const handleProfilePictureSelect = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const validationError = validateProfilePictureFile(file);
    if (validationError) {
      setProfilePictureError(validationError);
      return;
    }

    const generation = ++selectionGenerationRef.current;
    setIsValidatingPicture(true);
    setProfilePictureError("");
    try {
      const imageError = await inspectProfilePictureFile(file);
      if (generation !== selectionGenerationRef.current) return;
      if (imageError) {
        setProfilePictureError(imageError);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = previewUrl;
      removalBeforeSelectionRef.current = profilePicRemoved;
      setSelectedProfileImage({
        file,
        previewUrl,
      });
      setUploadedProfilePic("");
      setProfilePicRemoved(false);
    } catch {
      if (generation === selectionGenerationRef.current) {
        setProfilePictureError("This image is corrupt or could not be read.");
      }
    } finally {
      if (generation === selectionGenerationRef.current) {
        setIsValidatingPicture(false);
      }
    }
  };

  const handleProfilePictureRemove = () => {
    selectionGenerationRef.current += 1;
    setIsValidatingPicture(false);
    setProfilePictureError("");
    if (selectedProfileImage) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      setSelectedProfileImage(null);
      setUploadedProfilePic("");
      setProfilePicRemoved(removalBeforeSelectionRef.current);
      return;
    }
    setProfilePicRemoved(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitInFlightRef.current || isPending) return;
    if (isValidatingPicture) {
      toast.error("Wait for the selected photo to finish checking.");
      return;
    }

    submitInFlightRef.current = true;
    try {
      await completeOnboardingAsync({
        values: formState,
        imageFile: selectedProfileImage?.file || null,
        existingUpload: uploadedProfilePic,
        removePicture: profilePicRemoved,
      });
    } catch {
      // The mutation reports the failure; the entered form values remain intact.
    } finally {
      submitInFlightRef.current = false;
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-base-100 items-center justify-center flex p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="card bg-base-200 w-full max-w-3xl shadow-xl">
        <div className="card-body p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">
            Complete Your Profile
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <OnboardingProfilePicturePicker
              src={
                selectedProfileImage?.previewUrl ||
                (profilePicRemoved ? "" : authUser?.profilePic || "")
              }
              name={formState.fullName}
              userId={authUser?._id}
              hasSelectedFile={Boolean(selectedProfileImage)}
              isValidating={isValidatingPicture}
              isUploading={isUploadingPicture}
              uploadProgress={uploadProgress}
              disabled={isPending}
              error={profilePictureError}
              onSelect={handleProfilePictureSelect}
              onRemove={handleProfilePictureRemove}
            />

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
                  setFormState((current) => ({
                    ...current,
                    fullName: e.target.value,
                  }))
                }
                disabled={isPending}
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
                  setFormState((current) => ({
                    ...current,
                    bio: e.target.value,
                  }))
                }
                disabled={isPending}
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
                    setFormState((current) => ({
                      ...current,
                      nativeLanguage: e.target.value,
                    }))
                  }
                  disabled={isPending}
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
                    setFormState((current) => ({
                      ...current,
                      learningLanguage: e.target.value,
                    }))
                  }
                  disabled={isPending}
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
                    setFormState((current) => ({
                      ...current,
                      location: e.target.value,
                    }))
                  }
                  disabled={isPending}
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
                  setFormState((current) => ({
                    ...current,
                    interests: e.target.value,
                  }))
                }
                disabled={isPending}
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
              disabled={isPending || isValidatingPicture}
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
