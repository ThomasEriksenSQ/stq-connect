import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Companies from "./pages/Companies";
import Contacts from "./pages/Contacts";
import Activities from "./pages/Activities";
import Tasks from "./pages/Tasks";
import NotFound from "./pages/NotFound";

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

  return (
    <AppLayout />
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/selskaper" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoutes />}>
              <Route index element={<Navigate to="/selskaper" replace />} />
              <Route path="selskaper" element={<Companies />} />
              <Route path="kontakter" element={<Contacts />} />
              <Route path="aktiviteter" element={<Activities />} />
              <Route path="oppgaver" element={<Tasks />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
