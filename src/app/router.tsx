import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/app/layout";
import PaywallGate from "@/components/PaywallGate";

// Recarrega a página UMA vez se um chunk antigo sumiu após um deploy novo.
// Corrige o bug de "cliquei no menu, ficou amarelo, mas a tela não trocou"
// (a URL muda mas o componente da rota falha em carregar por causa do cache).
function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory()
      .then((m) => {
        try {
          sessionStorage.removeItem("orbis-chunk-reload");
        } catch {
          /* noop */
        }
        return m;
      })
      .catch((err) => {
        try {
          if (sessionStorage.getItem("orbis-chunk-reload") !== "1") {
            sessionStorage.setItem("orbis-chunk-reload", "1");
            window.location.reload();
            return new Promise<{ default: T }>(() => {});
          }
        } catch {
          /* noop */
        }
        throw err;
      }),
  );
}

const Index = lazyWithReload(() => import("@/pages/Index"));
const Transactions = lazyWithReload(() => import("@/pages/Transactions"));
const History = lazyWithReload(() => import("@/pages/History"));
const Insights = lazyWithReload(() => import("@/pages/Insights"));
const Profile = lazyWithReload(() => import("@/pages/Profile"));
const MyAccount = lazyWithReload(() => import("@/pages/MyAccount"));
const Settings = lazyWithReload(() => import("@/pages/Settings"));
const Products = lazyWithReload(() => import("@/pages/Products"));
const Chat = lazyWithReload(() => import("@/pages/Chat"));
const Routine = lazyWithReload(() => import("@/pages/Routine"));
const Finances = lazyWithReload(() => import("@/pages/Finances"));
const Auth = lazyWithReload(() => import("@/pages/Auth"));
const ForgotPassword = lazyWithReload(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazyWithReload(() => import("@/pages/ResetPassword"));
const ForcePasswordChange = lazyWithReload(() => import("@/pages/ForcePasswordChange"));
const Payment = lazyWithReload(() => import("@/pages/Payment"));
const Benefits = lazyWithReload(() => import("@/pages/Benefits"));
const AdminDemoUsers = lazyWithReload(() => import("@/pages/AdminDemoUsers"));
const AdminSubscriptions = lazyWithReload(() => import("@/pages/AdminSubscriptions"));
const AdminCompetitions = lazyWithReload(() => import("@/pages/AdminCompetitions"));
const AdminBrain = lazyWithReload(() => import("@/pages/AdminBrain"));
const AdminAntiCheat = lazyWithReload(() => import("@/pages/AdminAntiCheat"));
const AdminExtratoConfig = lazyWithReload(() => import("@/pages/AdminExtratoConfig"));
const TesteExtrato = lazyWithReload(() => import("@/pages/TesteExtrato"));
const TestRanking = lazyWithReload(() => import("@/pages/TestRanking"));
const MeuExtrato = lazyWithReload(() => import("@/pages/MeuExtrato"));
const BilhetePreview = lazyWithReload(() => import("@/pages/BilhetePreview"));
const Install = lazyWithReload(() => import("@/pages/Install"));
const NotFound = lazyWithReload(() => import("@/pages/NotFound"));
const DailyGoals = lazyWithReload(() => import("@/pages/DailyGoals"));
const Ranking = lazyWithReload(() => import("@/pages/Ranking"));
const Competitions = lazyWithReload(() => import("@/pages/Competitions"));
const X1 = lazyWithReload(() => import("@/pages/X1"));
const Rewards = lazyWithReload(() => import("@/pages/Rewards"));
const DefconChallenge = lazyWithReload(() => import("@/pages/DefconChallenge"));
const BankConnections = lazyWithReload(() => import("@/pages/BankConnections"));
const SpotFinder = lazyWithReload(() => import("@/pages/SpotFinder"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <PaywallGate />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/force-password-change" element={<ForcePasswordChange />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/benefits" element={<Benefits />} />
          <Route path="/install" element={<Install />} />
          <Route path="/defcon" element={<DefconChallenge />} />
          <Route path="/bilhete" element={<BilhetePreview />} />
          <Route
            path="/*"
            element={
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
                    <Route path="/competitions" element={<Competitions />} />
                    <Route path="/x1" element={<X1 />} />
                    <Route path="/rewards" element={<Rewards />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/my-account" element={<MyAccount />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/bank-connections" element={<BankConnections />} />
                    <Route path="/spot-finder" element={<SpotFinder />} />
                    <Route path="/meu-extrato" element={<MeuExtrato />} />
                    <Route path="/admin/demo-users" element={<AdminDemoUsers />} />
                    <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                    <Route path="/admin/competitions" element={<AdminCompetitions />} />
                    <Route path="/admin/ai-brain" element={<AdminBrain />} />
                    <Route path="/admin/anti-trapaca" element={<AdminAntiCheat />} />
                    <Route path="/admin/extrato-config" element={<AdminExtratoConfig />} />
                    <Route path="/admin/teste-extrato" element={<TesteExtrato />} />
                    <Route path="/admin/teste-ranking" element={<TestRanking />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
