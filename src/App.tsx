import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Blender from "@/pages/Blender";
import Toasts from "@/components/Toasts";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blend" element={<Blender />} />
      </Routes>
      <Toasts />
    </Router>
  );
}
