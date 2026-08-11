import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const Auth = lazy(() => import("./pages/Auth.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Pricing = lazy(() => import("./pages/Pricing.tsx"));
const Payment = lazy(() => import("./pages/Payment.tsx"));
const AdminPaymentRequests = lazy(() => import("./pages/admin/PaymentRequests.tsx"));

const JsonFormatter = lazy(() => import("./pages/tools/JsonFormatter.tsx"));
const ImageCompressor = lazy(() => import("./pages/tools/ImageCompressor.tsx"));
const FileToQr = lazy(() => import("./pages/tools/FileToQr.tsx"));
const LinkToQr = lazy(() => import("./pages/tools/LinkToQr.tsx"));
const FileToLink = lazy(() => import("./pages/tools/FileToLink.tsx"));
const LinkToFile = lazy(() => import("./pages/tools/LinkToFile.tsx"));
const CodeGenerator = lazy(() => import("./pages/tools/CodeGenerator.tsx"));
const UnitConverter = lazy(() => import("./pages/tools/UnitConverter.tsx"));
const StudyTimer = lazy(() => import("./pages/tools/StudyTimer.tsx"));
const UniversalEncoderDecoder = lazy(() => import("./pages/tools/UniversalEncoderDecoder.tsx"));
const ColorPaletteExtractor = lazy(() => import("./pages/tools/ColorPaletteExtractor.tsx"));
const CssGeneratorSuite = lazy(() => import("./pages/tools/CssGeneratorSuite.tsx"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/payment/:packageId" element={<Payment />} />
                <Route path="/admin/payments" element={<AdminPaymentRequests />} />

                <Route path="/tools/json-formatter" element={<JsonFormatter />} />
                <Route path="/tools/image-compressor" element={<ImageCompressor />} />
                <Route path="/tools/file-to-qr" element={<FileToQr />} />
                <Route path="/tools/link-to-qr" element={<LinkToQr />} />
                <Route path="/tools/file-to-link" element={<FileToLink />} />
                <Route path="/tools/link-to-file" element={<LinkToFile />} />
                <Route path="/tools/code-generator" element={<CodeGenerator />} />
                <Route path="/tools/unit-converter" element={<UnitConverter />} />
                <Route path="/tools/study-timer" element={<StudyTimer />} />
                <Route path="/tools/universal-encoder" element={<UniversalEncoderDecoder />} />
                <Route path="/tools/color-palette-extractor" element={<ColorPaletteExtractor />} />
                <Route path="/tools/css-generator-suite" element={<CssGeneratorSuite />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
