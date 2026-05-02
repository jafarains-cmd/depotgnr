"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  className?: string;
};

/**
 * Password input dengan toggle eye icon untuk show/hide.
 * Menerima semua attribut input HTML standar (value/onChange/name/required/etc).
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ className = "", ...props }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          {...props}
          type={show ? "text" : "password"}
          className={`pr-10 ${className}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center text-[color:var(--muted)] hover:text-ink"
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
