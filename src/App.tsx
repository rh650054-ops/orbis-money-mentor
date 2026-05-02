import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import SplashScreen from "./components/SplashScreen";
import AppErrorBoundary from "./components/AppErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const Transactions = lazy(() => import("./pages/Transactions"));
const History = lazy(() => import("./pages/History"));
const Insights = lazy(() => import("./pages/Insights"));
const Profile = lazy(() => import("./pages/Profile"));
const MyAccount = lazy(() => import("./pages/MyAccount"));
const Settings = lazy(() => import("./pages/Settings"));
const Products = lazy(() => import("./pages/Products"));
const Chat = lazy(() => import("./pages/Chat"));
const Routine = lazy(() => import("./pages/Routine"));
const Finances = lazy(() => import("./pages/Finances"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Payment = lazy(() => import("./pages/Payment"));
const Benefits = lazy(() => import("./pages/Benefits"));
const AdminDemoUsers = lazy(() => import("./pages/AdminDemoUsers"));
const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CheckIn = lazy(() => import("./pages/CheckIn"));
const DailyGoals = lazy(() => import("./pages/DailyGoals"));
const Ranking = lazy(() => import("./pages/Ranking"));
const Rewards = lazy(() => import("./pages/Rewards"));
const DefconChallenge = lazy(() => import("./pages/DefconChallenge"));
const BankConnections = lazy(() => import("./pages/BankConnections"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <SplashScreen />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/benefits" element={<Benefits />} />
              <Route path="/check-in" element={<CheckIn />} />
              <Route path="/install" element={<Install />} />
              <Route path="/defcon" element={<DefconChallenge />} />
              <Route path="/*" element={
                <Layout>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/transactions" element={<Transactions />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/insights" element={<Insights />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/routine" element={<Routine />} />
                      <Route path="/finances" element={<Finances />} />
                      <Route path="/daily-goals" element={<DailyGoals />} />
                      <Route path="/ranking" element={<Ranking />} />
                      <Route path="/rewards" element={<Rewards />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/my-account" element={<MyAccount />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/bank-connections" element={<BankConnections />} />
                      <Route path="/admin/demo-users" element={<AdminDemoUsers />} />
                      <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </Layout>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;