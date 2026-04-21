import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense, type ReactElement } from "react";
import { DesignVersionProvider, useDesignVersion } from "@/context/DesignVersionContext";
import { DesignVersionToggle } from "@/components/design/DesignVersionToggle";
import { getModernCompanyPath, getModernContactPath, type CrmRouteAlias } from "@/lib/crmNavigation";
import Login from "./pages/Login";
import CVMaker from "./pages/CVMaker";
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
import NettsideAI from "./pages/NettsideAI";
import CvEditor from "./pages/CvEditor";


const KonsulenterAnsatte = lazy(() => import("./pages/KonsulenterAnsatte"));
const KonsulenterOppdrag = lazy(() => import("./pages/KonsulenterOppdrag"));
const EksterneKonsulenter = lazy(() => import("./pages/EksterneKonsulenter"));
const StacqPrisen = lazy(() => import("./pages/StacqPrisen"));
const DesignLabStacqPrisen = lazy(() => import("./pages/DesignLabStacqPrisen"));
const DesignLabDashboard = lazy(() => import("./pages/DesignLabDashboard"));
const DesignLabMarkedsradar = lazy(() => import("./pages/DesignLabMarkedsradar"));
const DesignLabKonsulenterOppdrag = lazy(() => import("./pages/DesignLabKonsulenterOppdrag"));
const DesignLabKonsulenterAnsatte = lazy(() => import("./pages/DesignLabKonsulenterAnsatte"));
const DesignLabEksterneKonsulenter = lazy(() => import("./pages/DesignLabEksterneKonsulenter"));
const DesignLabNettsideAI = lazy(() => import("./pages/DesignLabNettsideAI"));
const ImporterCver = lazy(() => import("./pages/ImporterCver"));
const ImporterSelskaper = lazy(() => import("./pages/ImporterSelskaper"));
const Markedsradar = lazy(() => import("./pages/Markedsradar"));
const CvAdmin = lazy(() => import("./pages/CvAdmin"));
const Soknad = lazy(() => import("./pages/Soknad"));
const CompaniesMap = lazy(() => import("./pages/CompaniesMap"));
const AnsattDetail = lazy(() => import("./pages/AnsattDetail"));
const Innstillinger = lazy(() => import("./pages/Innstillinger"));
const DesignLabContacts = lazy(() => import("./pages/DesignLabContacts"));
const DesignLabContactDetail = lazy(() => import("./pages/DesignLabContactDetail"));
const DesignLabForesporsler = lazy(() => import("./pages/DesignLabForesporsler"));
const DesignLabOppfolginger = lazy(() => import("./pages/DesignLabOppfolginger"));
const DesignLabCompanies = lazy(() => import("./pages/DesignLabCompanies"));
const DesignLabStyleguide = lazy(() => import("./pages/DesignLabStyleguide"));
const DesignLabInnstillinger = lazy(() =>
  import("./pages/Innstillinger").then((m) => ({ default: m.InnstillingerV2 }))
);
const DesignLabHome = lazy(() => import("./pages/DesignLabHome"));
const DesignLabNews = lazy(() => import("./pages/DesignLabNews"));

const queryClient = new QueryClient();

function ProtectedAppLayout() {
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

function ProtectedCrmLayout() {
  const { user, loading } = useAuth();
  const { isV2Active } = useDesignVersion();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return isV2Active ? <Outlet /> : <AppLayout />;
}

function ProtectedMinimal() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Laster...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
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

function VersionedRoute({ v1, v2 }: { v1: ReactElement; v2: ReactElement }) {
  const { isV2Active } = useDesignVersion();
  return isV2Active ? v2 : v1;
}

function ModernContactDetailRedirect() {
  return <NavigateToModernDetail type="contact" alias="root" />;
}

function ModernCompanyDetailRedirect() {
  return <NavigateToModernDetail type="company" alias="root" />;
}

function DesignLabCompanyDetailRedirect() {
  return <NavigateToModernDetail type="company" alias="design-lab" />;
}

function NavigateToModernDetail({
  type,
  alias,
}: {
  type: "contact" | "company";
  alias: CrmRouteAlias;
}) {
  const { user, loading } = useAuth();
  const { id } = useParams<{ id: string }>();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!id) {
    return (
      <Navigate
        to={alias === "design-lab" ? (type === "contact" ? "/design-lab/kontakter" : "/design-lab/selskaper") : (type === "contact" ? "/kontakter" : "/selskaper")}
        replace
      />
    );
  }

  return (
    <Navigate
      to={type === "contact" ? getModernContactPath(id, alias) : getModernCompanyPath(id, alias)}
      replace
    />
  );
}

function AppRouter() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthRoute />} />
        <Route path="/cv/:token" element={<CvEditor />} />
        <Route path="/" element={<ProtectedCrmLayout />}>
          <Route
            index
            element={
              <VersionedRoute
                v1={<Dashboard />}
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabDashboard />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="selskaper"
            element={
              <VersionedRoute
                v1={<Companies />}
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabCompanies />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="selskaper/:id"
            element={
              <VersionedRoute
                v1={<CompanyDetail />}
                v2={<ModernCompanyDetailRedirect />}
              />
            }
          />
          <Route
            path="kontakter"
            element={
              <VersionedRoute
                v1={<Contacts />}
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabContacts />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="kontakter/:id"
            element={
              <VersionedRoute
                v1={<ContactDetail />}
                v2={<ModernContactDetailRedirect />}
              />
            }
          />
          <Route
            path="oppfolginger"
            element={
              <VersionedRoute
                v1={<Tasks />}
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabOppfolginger />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="foresporsler"
            element={
              <VersionedRoute
                v1={<Foresporsler />}
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabForesporsler />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="nettside-ai"
            element={
              <VersionedRoute
                v1={<NettsideAI />}
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabNettsideAI />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="stacq/prisen"
            element={
              <VersionedRoute
                v1={
                  <Suspense fallback={<LazyFallback />}>
                    <StacqPrisen />
                  </Suspense>
                }
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabStacqPrisen />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="markedsradar"
            element={
              <VersionedRoute
                v1={
                  <Suspense fallback={<LazyFallback />}>
                    <Markedsradar />
                  </Suspense>
                }
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabMarkedsradar />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="innstillinger"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Innstillinger />
              </Suspense>
            }
          />
          <Route
            path="konsulenter/ansatte/:id"
            element={
              <VersionedRoute
                v1={
                  <Suspense fallback={<LazyFallback />}>
                    <AnsattDetail />
                  </Suspense>
                }
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabKonsulenterAnsatte />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="konsulenter/ansatte"
            element={
              <VersionedRoute
                v1={
                  <Suspense fallback={<LazyFallback />}>
                    <KonsulenterAnsatte />
                  </Suspense>
                }
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabKonsulenterAnsatte />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="konsulenter/i-oppdrag"
            element={
              <VersionedRoute
                v1={
                  <Suspense fallback={<LazyFallback />}>
                    <KonsulenterOppdrag />
                  </Suspense>
                }
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabKonsulenterOppdrag />
                  </Suspense>
                }
              />
            }
          />
          <Route
            path="konsulenter/eksterne"
            element={
              <VersionedRoute
                v1={
                  <Suspense fallback={<LazyFallback />}>
                    <EksterneKonsulenter />
                  </Suspense>
                }
                v2={
                  <Suspense fallback={<LazyFallback />}>
                    <DesignLabEksterneKonsulenter />
                  </Suspense>
                }
              />
            }
          />
        </Route>
        <Route path="/" element={<ProtectedAppLayout />}>
          <Route
            path="selskaper/kart"
            element={
              <Suspense fallback={<LazyFallback />}>
                <CompaniesMap />
              </Suspense>
            }
          />
          <Route path="cv-maker" element={<CVMaker />} />
          <Route path="import" element={<Import />} />
          <Route path="admin/brreg-sync" element={<AdminBrregSync />} />
          <Route
            path="cv-admin/:ansattId"
            element={
              <Suspense fallback={<LazyFallback />}>
                <CvAdmin />
              </Suspense>
            }
          />
          <Route
            path="stacq/importer-cver"
            element={
              <Suspense fallback={<LazyFallback />}>
                <ImporterCver />
              </Suspense>
            }
          />
          <Route
            path="admin/importer-selskaper"
            element={
              <Suspense fallback={<LazyFallback />}>
                <ImporterSelskaper />
              </Suspense>
            }
          />
          <Route
            path="soknad"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Soknad />
              </Suspense>
            }
          />
        </Route>
        <Route path="/design-lab" element={<ProtectedMinimal />}>
          <Route index element={<Navigate to="salgsagent" replace />} />
          <Route
            path="salgsagent"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabDashboard />
              </Suspense>
            }
          />
          <Route
            path="kontakter"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabContacts />
              </Suspense>
            }
          />
          <Route
            path="kontakter/:id"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabContactDetail />
              </Suspense>
            }
          />
          <Route
            path="selskaper/:id"
            element={<DesignLabCompanyDetailRedirect />}
          />
          <Route
            path="foresporsler"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabForesporsler />
              </Suspense>
            }
          />
          <Route
            path="oppfolginger"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabOppfolginger />
              </Suspense>
            }
          />
          <Route
            path="stacq-prisen"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabStacqPrisen />
              </Suspense>
            }
          />
          <Route
            path="markedsradar"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabMarkedsradar />
              </Suspense>
            }
          />
          <Route
            path="aktive-oppdrag"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabKonsulenterOppdrag />
              </Suspense>
            }
          />
          <Route
            path="ansatte"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabKonsulenterAnsatte />
              </Suspense>
            }
          />
          <Route
            path="ansatte/:id"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabKonsulenterAnsatte />
              </Suspense>
            }
          />
          <Route
            path="eksterne"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabEksterneKonsulenter />
              </Suspense>
            }
          />
          <Route
            path="nettside-ai"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabNettsideAI />
              </Suspense>
            }
          />
          <Route
            path="selskaper"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabCompanies />
              </Suspense>
            }
          />
          <Route
            path="stilark"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabStyleguide />
              </Suspense>
            }
          />
          <Route
            path="innstillinger"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabInnstillinger />
              </Suspense>
            }
          />
          <Route
            path="home"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabHome />
              </Suspense>
            }
          />
          <Route
            path="news"
            element={
              <Suspense fallback={<LazyFallback />}>
                <DesignLabNews />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <DesignVersionToggle />
    </>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DesignVersionProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </TooltipProvider>
        </DesignVersionProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
