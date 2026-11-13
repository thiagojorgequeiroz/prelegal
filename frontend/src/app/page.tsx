import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Prelegal",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-stone-200">
        <div className="h-1.5 bg-accent" />
        <div className="p-8">
          <h1 className="font-serif text-3xl font-bold text-navy">Prelegal</h1>
          <p className="mt-1 mb-6 text-sm text-stone-600">Draft common legal agreements in minutes.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
