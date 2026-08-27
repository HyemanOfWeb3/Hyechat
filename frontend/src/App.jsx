import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import PageLoader from "./components/PageLoader.jsx";
import useAuthUser from "./hooks/useAuthUser.js";
import Layout from "./components/Layout.jsx";
import { useThemeStore } from "./store/useThemeStore.js";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const SignUpPage = lazy(() => import("./pages/SignUpPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const ForgetPasswordPage = lazy(() => import("./pages/ForgetPassword.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const CallPage = lazy(() => import("./pages/CallPage.jsx"));
const CallsPage = lazy(() => import("./pages/CallsPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const ChatsPage = lazy(() => import("./pages/ChatsPage.jsx"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage.jsx"));
const TestingPage = lazy(() => import("./pages/Testing.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const FriendsPage = lazy(() => import("./pages/FriendsPage.jsx"));
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
  const isOnboarded = authUser?.isOnboarded;

  if (isLoading) return <PageLoader />;

  return (
    <div className="h-screen" data-theme={theme}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <HomePage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/signup"
            element={
              !isAuthenticated ? (
                <SignUpPage />
              ) : (
                <Navigate to={isOnboarded ? "/" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <LoginPage />
              ) : (
                <Navigate to={isOnboarded ? "/" : "/onboarding"} />
              )
            }
          />
          <Route path="/forget-password" element={<ForgetPasswordPage />} />
          <Route
            path="/reset-password/:token"
            element={<ResetPasswordPage />}
          />
          <Route
            path="/notifications"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <NotificationsPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/profile"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <ProfilePage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/friends"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <FriendsPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/discover"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <FriendsPage initialTab="discover" />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/stories"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <StoriesPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/communities"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <CommunitiesPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route path="/group/:token" element={<CommunityInvitePage />} />
          <Route
            path="/communities/:id"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <CommunityChatPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/saved"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <FeatureFoundationPage
                    title="Saved"
                    description="Saved messages and bookmarks will appear here."
                  />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/calls"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <CallsPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/settings"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <SettingsPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/call/:id"
            element={
              isAuthenticated && isOnboarded ? (
                <CallPage />
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/chat"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={true}>
                  <ChatsPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          <Route
            path="/chat/:id"
            element={
              isAuthenticated && isOnboarded ? (
                <Layout showSidebar={false}>
                  <ChatPage />
                </Layout>
              ) : (
                <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
              )
            }
          />
          {/* <Route path="/chat" element={<Navigate to="/" replace />} />
          <Route path="/friends" element={<Navigate to="/" replace />} /> */}
          <Route
            path="/onboarding"
            element={
              isAuthenticated ? (
                !isOnboarded ? (
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

      <Toaster />
    </div>
  );
};

export default App;
