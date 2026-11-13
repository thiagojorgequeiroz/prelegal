"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { inputClass } from "./styles";

/**
 * Placeholder sign-in: there is no authentication yet, so submitting any
 * email and password simply brings the user into the platform.
 */
export function LoginForm() {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/nda/");
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-800">
          Email
        </label>
        <input id="email" type="email" autoComplete="email" placeholder="you@company.com" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-800">
          Password
        </label>
        <input id="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      <button
        type="submit"
        className="w-full rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90"
      >
        Sign in
      </button>
    </form>
  );
}
