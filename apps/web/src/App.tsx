import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./app/router";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster richColors theme="system" position="top-right" />
    </ThemeProvider>
  );
}

export default App;
