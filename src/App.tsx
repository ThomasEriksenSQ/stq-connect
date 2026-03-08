import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Tasks from "./pages/Tasks";
import NotFound from "./pages/NotFound";
import Import from "./pages/Import";
import AdminBrregSync from "./pages/AdminBrregSync";
import Foresporsler from "./pages/Foresporsler";

const KonsulenterAnsatte = lazy(() => import("./pages/KonsulenterAnsatte"));
const KonsulenterOppdrag = lazy(() => import("./pages/KonsulenterOppdrag"));

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <AppLayout />;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

const LazyFallback = () => (
  <p className="text-muted-foreground text-center py-12">Laster...</p>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthRoute />} />
              <Route path="/" element={<ProtectedRoutes />}>
                <Route index element={<Dashboard />} />
                <Route path="selskaper" element={<Companies />} />
                <Route path="selskaper/:id" element={<CompanyDetail />} />
                <Route path="kontakter" element={<Contacts />} />
                <Route path="kontakter/:id" element={<ContactDetail />} />
                <Route path="oppfolginger" element={<Tasks />} />
                <Route path="foresporsler" element={<Foresporsler />} />
                <Route path="foresporsler/:id" element={<Foresporsler />} />
                <Route path="import" element={<Import />} />
                <Route path="admin/brreg-sync" element={<AdminBrregSync />} />
                <Route
                  path="konsulenter/ansatte"
                  element={
                    <Suspense fallback={<LazyFallback />}>
                      <KonsulenterAnsatte />
                    </Suspense>
                  }
                />
                <Route
                  path="konsulenter/i-oppdrag"
                  element={
                    <Suspense fallback={<LazyFallback />}>
                      <KonsulenterOppdrag />
                    </Suspense>
                  }
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
