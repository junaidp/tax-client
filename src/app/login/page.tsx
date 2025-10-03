"use client";
import { useRouter } from "next/navigation";

const HMRC_LOGIN_URL = process.env.NEXT_PUBLIC_HMRC_LOGIN_URL as string;

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = () => {
    if (!HMRC_LOGIN_URL) {
      alert("HMRC login URL not configured");
      return;
    }
    // Redirect the browser to HMRC login page
    window.location.href = HMRC_LOGIN_URL;
  };

  return (
    <main>
      <h2 className="text-xl font-semibold mb-4">Login to HMRC</h2>
      <p className="mb-4 text-gray-700">You will be redirected to HMRC to grant access, then returned here.</p>
      <button onClick={handleLogin} className="btn-primary">Login to HMRC</button>
    </main>
  );
}
