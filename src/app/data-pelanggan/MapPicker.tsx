"use client";

import { useEffect, useState } from "react";
import { MapPickerGoogle } from "./MapPickerGoogle";
import { MapPickerOSM } from "./MapPickerOSM";

export function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [provider, setProvider] = useState<"google" | "osm">(apiKey ? "google" : "osm");

  useEffect(() => {
    if (provider !== "google") return;
    const t = setTimeout(() => {
      if (typeof window !== "undefined" && !(window as { google?: object }).google) {
        setProvider("osm");
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [provider]);

  if (provider === "google" && apiKey) {
    return (
      <MapPickerGoogle
        apiKey={apiKey}
        lat={lat}
        lng={lng}
        onPick={onPick}
        onFail={() => setProvider("osm")}
      />
    );
  }
  return <MapPickerOSM lat={lat} lng={lng} onPick={onPick} />;
}
