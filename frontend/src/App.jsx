import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import PageLoader from "./components/PageLoader.jsx";
import useAuthUser from "./hooks/useAuthUser.js";
import Layout from "./components/Layout.jsx";
import { useThemeStore } from "./store/useThemeStore.js";
import useInactivityLogout from "./hooks/useInactivityLogout.js";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const SignUpPage = lazy(() => import("./pages/SignUpPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const ForgetPasswordPage = lazy(() => import("./pages/ForgetPassword.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword.jsx"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const CallPage = lazy(() => import("./pages/CallPage.jsx"));
const CallsPage = lazy(() => import("./pages/CallsPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const ChatsPage = lazy(() => import("./pages/ChatsPage.jsx"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage.jsx"));
const TestingPage = lazy(() => import("./pages/Testing.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage.jsx"));
const FriendsPage = lazy(() => import("./pages/FriendsPage.jsx"));
const ExplorePage = lazy(() => import("./pages/ExplorePage.jsx"));
const GlobalSearchPage = lazy(() => import("./pages/GlobalSearchPage.jsx"));
const FeatureFoundationPage = lazy(
  () => import("./pages/FeatureFoundationPage.jsx"),
);
const StoriesPage = lazy(() => import("./pages/StoriesPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const CommunitiesPage = lazy(() => import("./pages/CommunitiesPage.jsx"));
const CommunityChatPage = lazy(() => import("./pages/CommunityChatPage.jsx"));
const CommunityInvitePage = lazy(
  () => import("./pages/CommunityInvitePage.jsx"),
);

const App = () => {
  const { isLoading, authUser } = useAuthUser();
  const { theme } = useThemeStore();

  const isAuthenticated = Boolean(authUser);
  const isEmailVerified = authUser?.emailVerified;
  const isOnboarded = authUser?.isOnboarded;
  const authenticatedRedirect = !isEmailVerified
    ? "/verify-email"
    : isOnboarded
      ? "/"
      : "/onboarding";
  const { showWarning, stayActive } = useInactivityLogout({
    enabled: isAuthenticated,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="app-shell h-[100dvh]" data-theme={theme}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <HomePage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/signup"
            element={
              !isAuthenticated ? (
                <SignUpPage />
              ) : (
                <Navigate to={authenticatedRedirect} />
              )
            }
          />
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <LoginPage />
              ) : (
                <Navigate to={authenticatedRedirect} />
              )
            }
          />
          <Route path="/forget-password" element={<ForgetPasswordPage />} />
          <Route
            path="/reset-password/:token"
            element={<ResetPasswordPage />}
          />
          <Route
            path="/verify-email"
            element={
              isAuthenticated ? (
                isEmailVerified ? (
                  <Navigate to={authenticatedRedirect} />
                ) : (
                  <VerifyEmailPage />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/notifications"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <NotificationsPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/profile"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <ProfilePage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/profile/:userId"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <UserProfilePage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/friends"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <FriendsPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/explore"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <ExplorePage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/search"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <GlobalSearchPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/discover"
            element={<Navigate to="/explore" replace />}
          />
          <Route
            path="/stories"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <StoriesPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/communities"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <CommunitiesPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route path="/group/:token" element={<CommunityInvitePage />} />
          <Route
            path="/communities/:id"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <CommunityChatPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/saved"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <FeatureFoundationPage
                    title="Saved"
                    description="Saved messages and bookmarks will appear here."
                  />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/calls"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <CallsPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/settings"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <SettingsPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/call/:id"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <CallPage />
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/chat"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={true}>
                  <ChatsPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          <Route
            path="/chat/:id"
            element={
              isAuthenticated && isEmailVerified && isOnboarded ? (
                <Layout showSidebar={false}>
                  <ChatPage />
                </Layout>
              ) : (
                <Navigate
                  to={!isAuthenticated ? "/login" : authenticatedRedirect}
                />
              )
            }
          />
          {/* <Route path="/chat" element={<Navigate to="/" replace />} />
          <Route path="/friends" element={<Navigate to="/" replace />} /> */}
          <Route
            path="/onboarding"
            element={
              isAuthenticated ? (
                !isEmailVerified ? (
                  <Navigate to="/verify-email" />
                ) : !isOnboarded ? (
                  <OnboardingPage />
                ) : (
                  <Navigate to="/" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route path="/testing" element={<TestingPage />} />
        </Routes>
      </Suspense>

      {showWarning && (
        <div
          role="alert"
          className="alert alert-warning fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg shadow-lg sm:left-auto sm:right-6 sm:w-auto"
        >
          <span>
            You&apos;ve been inactive for a while. You&apos;ll be logged out
            soon.
          </span>
          <button type="button" className="btn btn-sm" onClick={stayActive}>
            Stay signed in
          </button>
        </div>
      )}

      <Toaster />
    </div>
  );
};

export default App;
