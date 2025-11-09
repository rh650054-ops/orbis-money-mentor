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
import Chat from "./pages/Chat";
import Routine from "./pages/Routine";
import Finances from "./pages/Finances";
import Auth from "./pages/Auth";
import Payment from "./pages/Payment";
import AdminDemoUsers from "./pages/AdminDemoUsers";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();
const App = () => <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/*" element={<Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/history" element={<History />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/routine" element={<Routine />} />
                <Route path="/finances" element={<Finances />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin/demo-users" element={<AdminDemoUsers />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>;
export default App;