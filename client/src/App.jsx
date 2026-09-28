import { useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BookHeart, Compass, House, Map, Menu, Settings2, X } from "lucide-react";
import HomePage from "./pages/HomePage.jsx";
import PlannerPage from "./pages/PlannerPage.jsx";
import TripsPage, { TripDetailPage } from "./pages/TripsPage.jsx";
import MemoryPage from "./pages/MemoryPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

const navigation = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/planner", label: "Plan a trip", icon: Compass },
  { to: "/trips", label: "My trips", icon: Map },
  { to: "/memory", label: "Travel memory", icon: BookHeart },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const currentPage = navigation.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <NavLink className="brand" to="/" onClick={closeMenu}>
          <span className="brand-mark"><Compass size={21} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>tripmind<span className="brand-period">.</span></span>
        </NavLink>
        <p className="sidebar-label">YOUR SPACE</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMenu}
              className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {label === "Travel memory" && <span className="nav-spark" aria-label="Personalized">✳</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-orb" aria-hidden="true"><BookHeart size={16} /></span>
          <p><strong>Good trips start with knowing you.</strong><br />Your preferences stay yours.</p>
          <NavLink to="/memory" onClick={closeMenu}>See your memory <span aria-hidden="true">→</span></NavLink>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Made for the way you wander</div>
      </aside>

      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={closeMenu} />}
      <div className={`mobile-drawer${mobileMenuOpen ? " mobile-drawer-open" : ""}`} aria-hidden={!mobileMenuOpen}>
        <div className="mobile-drawer-head">
          <NavLink className="brand" to="/" onClick={closeMenu}>
            <span className="brand-mark"><Compass size={21} aria-hidden="true" /></span>
            <span>tripmind<span className="brand-period">.</span></span>
          </NavLink>
          <button className="icon-button" type="button" onClick={closeMenu} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav id="mobile-navigation" className="sidebar-nav" aria-label="Mobile navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={closeMenu}
              className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <main id="main-content" className="main-column">
        <header className="mobile-topbar">
          <button className="icon-button mobile-menu-trigger" type="button" aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={21} />
          </button>
          <span className="mobile-page-name">{currentPage?.label || "Your trip"}</span>
          <NavLink className="mobile-avatar" to="/memory" aria-label="View your travel memory">T</NavLink>
        </header>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/trips/:id" element={<TripDetailPage />} />
            <Route path="/memory" element={<MemoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </div>
        <footer className="app-footer">
          <span>TripMind <span aria-hidden="true">·</span> Travel, remembered.</span>
          <NavLink to="/settings">Your data, your choice</NavLink>
        </footer>
      </main>
    </div>
  );
}
