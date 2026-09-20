import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { ManagerPage } from "./pages/ManagerPage";
import { GuestPage } from "./pages/GuestPage";
import { TicketPage } from "./pages/TicketPage";
import { TicketsPage } from "./pages/TicketsPage";
import { ThemeToggle } from "./components/ThemeToggle";

export default function App() {
  return (
    <>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Navigate to="/board" replace />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/board" element={<ManagerPage />} />
        <Route path="/board/tickets" element={<TicketsPage />} />
        <Route path="/p/:slug" element={<GuestPage />} />
        <Route path="/t/:slug" element={<TicketPage />} />
      </Routes>
    </>
  );
}
