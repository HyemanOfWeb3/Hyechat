import { useState } from "react";
import Navbar from "./Navbar.jsx";
import Sidebar from "./Sidebar.jsx";
import useNotificationSocket from "../hooks/useNotificationSocket.js";
import IncomingCallOverlay from "./IncomingCallOverlay.jsx";

const Layout = ({ children, showSidebar = false }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useNotificationSocket();

  return (
    <div className="h-screen overflow-hidden">
      <IncomingCallOverlay />
      <div className="flex h-full">
        {showSidebar && (
          <Sidebar
            collapsed={sidebarCollapsed}
            mobileOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            onMenuClick={() => setSidebarOpen(true)}
            onCollapseClick={() =>
              setSidebarCollapsed((collapsed) => !collapsed)
            }
            sidebarCollapsed={sidebarCollapsed}
          />
          <main className="flex min-h-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
