import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "@/features/auth/pages/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import DashboardLayout from "@/layouts/DashboardLayout";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import SupervisorDashboard from "@/pages/supervisor/SupervisorDashboard";
import AgentDashboard from "@/pages/agent/AgentDashboard";
import { useAuthStore } from "@/features/auth/store/authStore";

/** Send the user to their role's home, or to login if anonymous. */
function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (user?.role) {
    case "ADMIN":
      return <Navigate to="/admin" replace />;
    case "SUPERVISOR":
      return <Navigate to="/supervisor" replace />;
    case "AGENT":
      return <Navigate to="/agent" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <LoginPage /> },

  // Authenticated shell — DashboardLayout renders <Outlet/>.
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/admin",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/supervisor",
        element: (
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/agent",
        element: (
          <ProtectedRoute allowedRoles={["AGENT"]}>
            <AgentDashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
