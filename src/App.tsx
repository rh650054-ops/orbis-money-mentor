import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Transactions from "./pages/Transactions";
import History from "./pages/History";
import Insights from "./pages/Insights";
import Profile from "./pages/Profile";
import MyAccount from "./pages/MyAccount";
import Settings from "./pages/Settings";
import Products from "./pages/Products";
import Chat from "./pages/Chat";
import Routine from "./pages/Routine";
import Finances from "./pages/Finances";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SplashScreen from "./components/SplashScreen";
import Payment from "./pages/Payment";
import Benefits from "./pages/Benefits";
import AdminDemoUsers from "./pages/AdminDemoUsers";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import CheckIn from "./pages/CheckIn";
import DailyGoals from "./pages/DailyGoals";
import Ranking from "./pages/Ranking";
import Rewards from "./pages/Rewards";
import DefconChallenge from "./pages/DefconChallenge";
import BankConnections from "./pages/BankConnections";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <SplashScreen />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/benefits" element={<Benefits />} />
          <Route path="/check-in" element={<CheckIn />} />
          <Route path="/install" element={<Install />} />
          <Route path="/defcon" element={<DefconChallenge />} />
          <Route path="/install" element={<Install />} />
          <Route path="/*" element={
            <Layout>
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
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;