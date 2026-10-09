import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { ContactProvider } from "./components/ContactModal";
import { SiteModalsProvider } from "./components/SiteModals";
import { SiteProvider } from "./content";
import PreviewBridge from "./components/PreviewBridge";
import Home from "./pages/Home";
import { AuthProvider, RequireAuth } from "./admin/AuthContext";
import AdminLayout from "./admin/AdminLayout";
import Login from "./admin/pages/Login";
import { ConfirmProvider, ToastProvider } from "./admin/ui";
import { ContentPage } from "./admin/pages/ContentPage";
import { ProjectEditPage, ProjectsListPage } from "./admin/pages/ProjectsPages";
import { AccountPage, AppearancePage, DashboardPage, MediaPage, MessagesPage } from "./admin/pages/OtherPages";
import "./components/layout.css";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Laisse le temps à la page de se rendre avant de viser l'ancre
      const id = setTimeout(() => document.querySelector(hash)?.scrollIntoView(), 120);
      return () => clearTimeout(id);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/** Site public : barre de navigation + pied de page + modale de contact. */
function PublicLayout() {
  return (
    <SiteProvider>
      <ContactProvider>
        <SiteModalsProvider>
          <Navbar />
          <main>
            <Outlet />
          </main>
          <Footer />
          <PreviewBridge />
        </SiteModalsProvider>
      </ContactProvider>
    </SiteProvider>
  );
}

/** Espace admin : session, notifications et confirmations. */
function AdminShell() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Outlet />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/charte-graphique" element={<Navigate to="/" replace />} />
        </Route>

        <Route path="/admin" element={<AdminShell />}>
          <Route path="connexion" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="contenu/:section?" element={<ContentPage />} />
            {/* anciennes adresses → la section correspondante de « Mon site » */}
            {[
              ["profil", "profil"],
              ["textes", "accueil"],
              ["competences", "stack"],
              ["experiences", "experiences"],
              ["formation", "methode"],
              ["chiffres", "chiffres"]
            ].map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={`/admin/contenu/${to}`} replace />} />
            ))}
            <Route path="projets" element={<ProjectsListPage />} />
            <Route path="projets/:id" element={<ProjectEditPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="medias" element={<MediaPage />} />
            <Route path="apparence" element={<AppearancePage />} />
            <Route path="compte" element={<AccountPage />} />
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </>
  );
}
